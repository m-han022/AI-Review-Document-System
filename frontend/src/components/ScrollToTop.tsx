import { useEffect, useState } from "react";

import { useTranslation } from "./LanguageSelector";
import { ArrowUpIcon } from "./ui/Icon";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button className="scroll-to-top" onClick={scrollToTop} title={t("common.scrollToTop")} aria-label={t("common.scrollToTop")}>
      <ArrowUpIcon size="md" />
    </button>
  );
}
