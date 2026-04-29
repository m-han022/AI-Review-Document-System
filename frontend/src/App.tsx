import { QueryClientProvider } from "@tanstack/react-query";

import Dashboard from "./components/Dashboard";
import { LanguageProvider } from "./components/LanguageSelector";
import ScrollToTop from "./components/ScrollToTop";
import { queryClient } from "./query";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <Dashboard />
        <ScrollToTop />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
