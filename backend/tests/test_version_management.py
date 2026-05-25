import pytest
from sqlmodel import Session, select, delete
from app.database import engine, create_db_and_tables
from app.models import Rubric, PromptVersion, EvaluationPolicy, GradingRun, EvaluationSet, RequiredRuleSet
from app.services.prompt_composer import PromptComposer
from app.services.grading_engine import build_grading_signature

create_db_and_tables()

def test_version_archiving():
    with Session(engine) as session:
        # 1. Test Rubric Archiving
        from app.rubric import activate_rubric_version, save_rubric_version, RubricVersionPayload
        
        doc_type = "test-archive"
        session.exec(delete(Rubric).where(Rubric.document_type == doc_type))
        session.commit()
        # Seed v1
        r1 = Rubric(document_type=doc_type, version="v1", active=True, status="active", created_at="now")
        session.add(r1)
        session.commit()
        
        # Save v2
        payload = RubricVersionPayload(
            version="v2",
            criteria=[],
            prompt={"vi": "test v2"}
        )
        # Mock total_score check bypass or use valid criteria
        # For simplicity, let's just manually add to DB and call activate
        r2 = Rubric(document_type=doc_type, version="v2", active=False, status="active", created_at="now")
        session.add(r2)
        session.commit()
        
        activate_rubric_version(doc_type, "v2")
        
        session.expire_all()
        r1_after = session.exec(select(Rubric).where(Rubric.version == "v1", Rubric.document_type == doc_type)).first()
        r2_after = session.exec(select(Rubric).where(Rubric.version == "v2", Rubric.document_type == doc_type)).first()
        
        assert r1_after.active is False
        assert r1_after.status == "archived"
        assert r2_after.active is True
        assert r2_after.status == "active"

def test_prompt_version_active_logic():
    with Session(engine) as session:
        doc_type = "test-prompt"
        level = "medium"
        session.exec(
            delete(PromptVersion).where(
                PromptVersion.document_type == doc_type,
                PromptVersion.level == level,
            )
        )
        session.commit()
        
        p1 = PromptVersion(document_type=doc_type, level=level, version="p1", content="c1", status="active")
        session.add(p1)
        session.commit()
        
        # Manual archiving logic for PromptVersion (should be in a service, but testing logic here)
        def activate_prompt(dtype, lvl, ver):
            with Session(engine) as s:
                all_p = s.exec(select(PromptVersion).where(PromptVersion.document_type == dtype, PromptVersion.level == lvl)).all()
                for p in all_p:
                    p.status = "archived"
                target = next(p for p in all_p if p.version == ver)
                target.status = "active"
                s.commit()
        
        p2 = PromptVersion(document_type=doc_type, level=level, version="p2", content="c2", status="archived")
        session.add(p2)
        session.commit()
        
        activate_prompt(doc_type, level, "p2")
        
        session.expire_all()
        p1_after = session.exec(select(PromptVersion).where(PromptVersion.version == "p1")).first()
        p2_after = session.exec(select(PromptVersion).where(PromptVersion.version == "p2")).first()
        
        assert p1_after.status == "archived"
        assert p2_after.status == "active"

def test_prompt_composer_composition():
    # Mock objects
    rubric = Rubric(version="r1")
    rubric_text = "rubric-content"
    policy = EvaluationPolicy(version="pol1", content="policy-content")
    prompt_ver = PromptVersion(version="pr1", content="prompt-content")
    rules_set = RequiredRuleSet(version="system-rules-v1", hash="h1", content='["JSON only"]', status="active")
    
    bundle = PromptComposer.compose(rubric, rubric_text, policy, prompt_ver, rules_set, required_rule_hash=rules_set.hash)
    
    assert "rubric-content" in bundle.full_prompt
    assert "policy-content" in bundle.full_prompt
    assert "prompt-content" in bundle.full_prompt
    assert "JSON only" in bundle.full_prompt
    
    assert bundle.rubric_version == "r1"
    assert bundle.policy_version == "pol1"
    assert bundle.prompt_version == "pr1"

def test_cache_signature_changes():
    text = "document content"
    dtype = "project-review"
    level = "medium"

    with Session(engine) as session:
        session.exec(
            delete(EvaluationSet).where(
                EvaluationSet.document_type == dtype,
                EvaluationSet.level == level,
            )
        )
        session.exec(
            delete(PromptVersion).where(
                PromptVersion.document_type == dtype,
                PromptVersion.level == level,
            )
        )
        prompt = PromptVersion(
            document_type=dtype,
            level=level,
            version="cache-v1",
            content="BASE PROMPT CONTENT",
            status="active",
        )
        session.add(prompt)
        session.commit()
        session.refresh(prompt)

        rubric = session.exec(
            select(Rubric).where(Rubric.document_type == dtype, Rubric.status == "active")
        ).first()
        assert rubric is not None

        policy = session.exec(
            select(EvaluationPolicy).where(EvaluationPolicy.level == level, EvaluationPolicy.status == "active")
        ).first()
        if policy is None:
            policy = session.exec(
                select(EvaluationPolicy).where(EvaluationPolicy.level == level)
            ).first()
            if policy is None:
                policy = EvaluationPolicy(
                    level=level,
                    version="cache-policy-v1",
                    content="cache policy content",
                    status="active",
                    created_at="now",
                )
            else:
                policy.status = "active"
            session.add(policy)
            session.commit()
            session.refresh(policy)

        rules = session.exec(select(RequiredRuleSet).where(RequiredRuleSet.status == "active")).first()
        if rules is None:
            rules = RequiredRuleSet(
                version="cache-rules-v1",
                hash="cache-rules-hash-v1",
                content='["JSON only"]',
                status="active",
                created_at="now",
            )
            session.add(rules)
            session.commit()
            session.refresh(rules)

        session.add(
            EvaluationSet(
                name=f"{dtype}-{level}-cache-test",
                document_type=dtype,
                level=level,
                rubric_version_id=rubric.id,
                prompt_version_id=prompt.id,
                policy_version_id=policy.id,
                required_rule_set_id=rules.id,
                required_rules_version=rules.version,
                required_rule_hash=rules.hash,
                status="active",
                version_label=f"{dtype}-{level}-cache-test-v1",
                created_at="now",
            )
        )
        session.commit()
    
    # Initial signature
    sig1 = build_grading_signature(text, "ja", dtype, prompt_level=level)
    
    # Change prompt version content in DB
    with Session(engine) as session:
        p = session.exec(
            select(PromptVersion).where(
                PromptVersion.document_type == dtype,
                PromptVersion.level == level,
                PromptVersion.status == "active",
            )
        ).first()
        p.content = "UPDATED PROMPT CONTENT"
        session.add(p)
        session.commit()

    sig2 = build_grading_signature(text, "ja", dtype, prompt_level=level)
    
    assert sig1["prompt_hash"] != sig2["prompt_hash"]
    assert sig1["required_rule_hash"] == sig2["required_rule_hash"] # Rules didn't change
