import { useState } from "react";
import type { LanguageCode } from "../../types";

export function useSubmissionsFilters() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "pending">("all");
  const [languageFilter, setLanguageFilter] = useState<LanguageCode | "all">("all");

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    languageFilter,
    setLanguageFilter,
  };
}

