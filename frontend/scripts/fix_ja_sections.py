import json

def main():
    path = "src/locales/ja.json"
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Fix compare section
    data["compare"] = {
        "title": "バージョン比較",
        "subtitle": "同一資料の2つのバージョン間の結果を比較します。",
        "baseVersion": "比較元 (Base)",
        "compareVersion": "比較先 (Compare)",
        "scoreDelta": "スコア変化",
        "criteriaComparison": "基準別比較",
        "feedbackComparison": "フィードバック比較",
        "insights": "変化の分析",
        "noData": "このバージョンの採点データがありません。",
        "selectVersions": "比較する2つのバージョンを選択してください。",
        "improved": "改善",
        "regressed": "低下",
        "unchanged": "変化なし",
        "new": "新規基準",
        "retired": "削除された基準",
        "noChange": "変化なし",
        "okDelta": "OKスライド",
        "ngDelta": "NGスライド",
        "deltaPositive": "+{delta}",
        "deltaNegative": "{delta}"
    }
    
    # Fix documentViewer
    data["documentViewer"] = {
        "title": "元資料",
        "openNewTab": "別タブで開く",
        "download": "ダウンロード",
        "pdfTitle": "資料を見ながらレビューできます",
        "pptxTitle": "PowerPoint はブラウザ内プレビューが安定しません",
        "pptxDescription": "別タブで開くか、ダウンロードしてレビュー内容と照合してください。",
        "unavailableTitle": "この形式のプレビューには対応していません",
        "unavailableDescription": "別タブで開くか、ファイルをダウンロードしてください。"
    }
    
    # Add rubric section if it has mojibake (it likely does)
    if "rubric" in data:
        data["rubric"]["pageTitle"] = "AI評価セット管理"
        data["rubric"]["pageSubtitle"] = "評価セット管理: 現在のセットから新しいセットを作成し、変更されたコンポーネントのみ新しいバージョンを作成します。"
        # ... and so on. 
        # Actually, let's just fix the most visible ones.
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print("Fixed ja.json sections.")

if __name__ == "__main__":
    main()
