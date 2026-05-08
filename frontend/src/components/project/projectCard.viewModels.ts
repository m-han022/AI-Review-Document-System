import type { GradingRun, GradingRunDetail, LanguageCode } from "../../types";
import type { FeedbackSectionView } from "./ProjectReviewPanels";
import type { OrderedScoreItem } from "./projectCard.helpers";

export interface ProjectCriteriaTabViewModel {
  lang: LanguageCode;
  gradingDetail?: GradingRunDetail;
  orderedScores: OrderedScoreItem[];
  hoveredCriterion: string | null;
  result?: GradingRun;
  feedbackSections: FeedbackSectionView[];
}

export interface SlideViewItem {
  id: number;
  slide_number: number;
  status: "OK" | "NG";
  displayTitle: string;
  summary: string;
  issues: string[];
  suggestions: string;
}

export interface ProjectSlidesTabViewModel {
  gradingDetail?: GradingRunDetail;
  slideReviewItems: SlideViewItem[];
  activeSlide: SlideViewItem | null;
}
