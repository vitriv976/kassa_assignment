import { useState } from "react";
import "./App.css";
import { SearchPage } from "./pages/SearchPage";
import { AdminPage } from "./pages/AdminPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { SearchConfigProvider } from "./state/SearchConfigContext";
import { EvaluationProvider } from "./state/EvaluationContext";
import { SearchHistoryProvider } from "./state/SearchHistoryContext";
import { ApiKeysProvider, useApiKeys } from "./state/ApiKeysContext";
import { ToastProvider } from "./components/ui/toast";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Search, Settings, Key, BarChart3 } from "lucide-react";
import { ApiKeyModal } from "./components/ApiKeyModal";

type TabKey = "search" | "admin" | "evaluation";

function AppContent() {
  const [activeTab, setActiveTab] = useState<TabKey>("search");
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const { apiKeys } = useApiKeys();

  // Count how many keys are set
  const keysSet = Object.values(apiKeys).filter(Boolean).length;

  return (
    <ToastProvider>
      <SearchConfigProvider>
        <EvaluationProvider>
          <SearchHistoryProvider>
            <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
              <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-8">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md">
                        <span className="text-lg sm:text-xl font-bold">F</span>
                      </div>
                      <div>
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                          Furnivision
                        </h1>
                        <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">Visual Product Search</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => setApiKeyModalOpen(true)}
                        className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
                        title={keysSet > 0 ? `${keysSet} API key(s) set` : "No API keys set"}
                      >
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">API Keys</span>
                        <Badge variant={keysSet > 0 ? "default" : "secondary"} className="text-[10px] sm:text-xs px-1.5 sm:px-2">
                          {keysSet > 0 ? `${keysSet} set` : "Not set"}
                        </Badge>
                      </button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("search")}
                        className={`${activeTab === "search" ? "bg-accent" : ""} px-2 sm:px-3`}
                        title="Search"
                      >
                        <Search className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Search</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("admin")}
                        className={`${activeTab === "admin" ? "bg-accent" : ""} px-2 sm:px-3`}
                        title="Admin"
                      >
                        <Settings className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Admin</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab("evaluation")}
                        className={`${activeTab === "evaluation" ? "bg-accent" : ""} px-2 sm:px-3`}
                        title="Evaluation"
                      >
                        <BarChart3 className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Evaluation</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </header>
              <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8 max-w-7xl">
                {activeTab === "search" && <SearchPage onOpenApiKeyModal={() => setApiKeyModalOpen(true)} />}
                {activeTab === "admin" && <AdminPage />}
                {activeTab === "evaluation" && <EvaluationPage />}
              </main>
              <ApiKeyModal
                open={apiKeyModalOpen}
                onOpenChange={setApiKeyModalOpen}
              />
            </div>
          </SearchHistoryProvider>
        </EvaluationProvider>
      </SearchConfigProvider>
    </ToastProvider>
  );
}

function App() {
  return (
    <ApiKeysProvider>
      <AppContent />
    </ApiKeysProvider>
  );
}

export default App;
