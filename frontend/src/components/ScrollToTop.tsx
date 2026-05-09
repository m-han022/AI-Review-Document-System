import { useEffect, useState } from "react";

import { useTranslation } from "./LanguageSelector";
import { ArrowUpIcon } from "./ui/Icon";

export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const scrollContainer = document.getElementById("main-scroll-container");
    if (!scrollContainer) return;

    const toggleVisibility = () => {
      setIsVisible(scrollContainer.scrollTop > 300);
    };

    scrollContainer.addEventListener("scroll", toggleVisibility);
    return () => scrollContainer.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    const scrollContainer = document.getElementById("main-scroll-container");
    if (scrollContainer) {
      scrollContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
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
