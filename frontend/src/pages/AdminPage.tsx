import { useState, useEffect } from "react";
import { useSearchConfig } from "../state/SearchConfigContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Slider } from "../components/ui/slider";
import { Switch } from "../components/ui/switch";
import { Select, SelectItem } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Brain, List, ArrowLeftRight, Filter, RotateCcw, AlertCircle } from "lucide-react";
import { useToast } from "../components/ui/toast";

type Provider = "openai" | "anthropic" | "google";

const providerModels: Record<Provider, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-4o-mini", "gpt-3.5-turbo"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  google: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
};

const embeddingModels: Record<Provider, string[]> = {
  openai: ["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"],
  anthropic: [], // Anthropic doesn't support embeddings
  google: ["text-embedding-004"],
};

export function AdminPage() {
  const { config, setConfig } = useSearchConfig();
  const { addToast } = useToast();
  const [provider, setProvider] = useState<Provider>((config.aiProvider as Provider) || "openai");
  const [model, setModel] = useState(config.aiModel || "gpt-4o");
  const [embeddingProvider, setEmbeddingProvider] = useState<Provider>((config.embeddingProvider as Provider) || config.aiProvider as Provider || "openai");
  const [embeddingModel, setEmbeddingModel] = useState(config.embeddingModel || "text-embedding-3-small");

  const defaultConfig = {
    maxCandidates: 200,
    topK: 20,
    minScore: 0.2,
    imageWeight: 0.6,
    textWeight: 0.25,
    priceProximityWeight: 0.15,
    backendUrl: "http://localhost:4000",
    priceRangeEnabled: false,
    priceRangeMin: 0,
    priceRangeMax: 10000,
  };

  const totalWeight = config.imageWeight + config.textWeight + config.priceProximityWeight;
  const weightError = Math.abs(totalWeight - 1.0) > 0.01;

  // Sync provider/model with config on mount and when config changes
  useEffect(() => {
    if (config.aiProvider && config.aiProvider !== provider) {
      setProvider(config.aiProvider as Provider);
    }
    if (config.aiModel && config.aiModel !== model) {
      setModel(config.aiModel);
    }
    if (config.embeddingProvider && config.embeddingProvider !== embeddingProvider) {
      setEmbeddingProvider(config.embeddingProvider as Provider);
    }
    if (config.embeddingModel && config.embeddingModel !== embeddingModel) {
      setEmbeddingModel(config.embeddingModel);
    }
  }, [config, provider, model, embeddingProvider, embeddingModel]);

  useEffect(() => {
    if (weightError) {
      addToast({
        title: "Weights must sum to 100%",
        description: `Currently ${(totalWeight * 100).toFixed(0)}%`,
        variant: "error",
      });
    }
  }, [weightError, totalWeight, addToast]);

  const handleReset = () => {
    const resetConfig = {
      ...defaultConfig,
      aiProvider: "openai",
      aiModel: "gpt-4o",
      embeddingProvider: "openai",
      embeddingModel: "text-embedding-3-small",
    };
    setConfig(resetConfig);
    setProvider("openai");
    setModel("gpt-4o");
    setEmbeddingProvider("openai");
    setEmbeddingModel("text-embedding-3-small");
    addToast({
      title: "Reset to defaults",
      description: "All settings have been reset",
      variant: "success",
    });
  };

  const handleSliderChange = (key: keyof typeof config, value: number) => {
    setConfig({ ...config, [key]: value });
  };

  const handleSwitchChange = (key: "priceRangeEnabled", checked: boolean) => {
    setConfig({ ...config, [key]: checked });
  };

  const handlePriceRangeChange = (key: "priceRangeMin" | "priceRangeMax", value: number) => {
    setConfig({ ...config, [key]: value });
  };

  const handleProviderChange = (value: string) => {
    const newProvider = value as Provider;
    const newModel = providerModels[newProvider][0];
    setProvider(newProvider);
    setModel(newModel);
    setConfig({ ...config, aiProvider: newProvider, aiModel: newModel });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    setConfig({ ...config, aiModel: value });
  };

  const handleEmbeddingProviderChange = (value: string) => {
    const newProvider = value as Provider;
    if (newProvider === "anthropic") {
      addToast({
        title: "Anthropic doesn't support embeddings",
        description: "Please select OpenAI or Google for embeddings",
        variant: "error",
      });
      return;
    }
    const newModel = embeddingModels[newProvider][0];
    setEmbeddingProvider(newProvider);
    setEmbeddingModel(newModel);
    setConfig({ ...config, embeddingProvider: newProvider, embeddingModel: newModel });
  };

  const handleEmbeddingModelChange = (value: string) => {
    setEmbeddingModel(value);
    setConfig({ ...config, embeddingModel: value });
  };

  const normalizeWeights = () => {
    const total = config.imageWeight + config.textWeight + config.priceProximityWeight;
    if (total > 0) {
      setConfig({
        ...config,
        imageWeight: config.imageWeight / total,
        textWeight: config.textWeight / total,
        priceProximityWeight: config.priceProximityWeight / total,
      });
      addToast({
        title: "Weights normalized",
        description: "All weights have been adjusted to sum to 100%",
        variant: "success",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Image-Based Product Search
        </h1>
        <p className="text-muted-foreground">
          Upload a furniture image to find matching products from the catalog.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>Vision Model</CardTitle>
            </div>
            <CardDescription>Model used for image analysis and furniture detection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="google">Google (Gemini)</SelectItem>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={handleModelChange}>
                {providerModels[provider].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              <CardTitle>Embedding Model</CardTitle>
            </div>
            <CardDescription>Model used for semantic similarity (text embeddings)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={embeddingProvider} onValueChange={handleEmbeddingProviderChange}>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="anthropic" disabled>Anthropic (Not supported)</SelectItem>
              </Select>
              <p className="text-xs text-muted-foreground">
                Anthropic doesn't provide embeddings. Use OpenAI or Google for embeddings.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={embeddingModel} onValueChange={handleEmbeddingModelChange}>
                {embeddingModels[embeddingProvider].map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </Select>
            </div>
            {provider === "anthropic" && embeddingProvider === "openai" && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-900">
                  <strong>Note:</strong> When using Anthropic for vision, OpenAI will be used for embeddings automatically.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <List className="h-5 w-5" />
              <CardTitle>Retrieval Settings</CardTitle>
            </div>
            <CardDescription>Control result count and similarity threshold</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="maxCandidates">Max Candidates</Label>
                <span className="text-sm font-semibold">{config.maxCandidates}</span>
              </div>
              <Slider
                id="maxCandidates"
                value={config.maxCandidates}
                onValueChange={(v) => handleSliderChange("maxCandidates", v)}
                min={10}
                max={500}
                step={10}
              />
              <p className="text-xs text-muted-foreground">
                Upper bound on how many products we consider per query before ranking
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="topK">Max Results</Label>
                <span className="text-sm font-semibold">{config.topK}</span>
              </div>
              <Slider
                id="topK"
                value={config.topK}
                onValueChange={(v) => handleSliderChange("topK", v)}
                min={1}
                max={50}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of products returned per search
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="minScore">Similarity Threshold</Label>
                <span className="text-sm font-semibold">{(config.minScore * 100).toFixed(0)}%</span>
              </div>
              <Slider
                id="minScore"
                value={config.minScore}
                onValueChange={(v) => handleSliderChange("minScore", v)}
                min={0}
                max={1}
                step={0.01}
              />
              <p className="text-xs text-muted-foreground">
                Minimum match score required for a product to appear in results
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" />
              <CardTitle>Ranking Weights</CardTitle>
            </div>
            <CardDescription>How results are scored and ordered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {weightError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">
                    Weights must sum to 100%
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Currently {(totalWeight * 100).toFixed(0)}%
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={normalizeWeights}
                  >
                    Normalize to 100%
                  </Button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="imageWeight">Visual Similarity</Label>
                <span className="text-sm font-semibold">{(config.imageWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                id="imageWeight"
                value={config.imageWeight}
                onValueChange={(v) => handleSliderChange("imageWeight", v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="textWeight">Category Match</Label>
                <span className="text-sm font-semibold">{(config.textWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                id="textWeight"
                value={config.textWeight}
                onValueChange={(v) => handleSliderChange("textWeight", v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="priceProximityWeight">Price Proximity</Label>
                <span className="text-sm font-semibold">{(config.priceProximityWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                id="priceProximityWeight"
                value={config.priceProximityWeight}
                onValueChange={(v) => handleSliderChange("priceProximityWeight", v)}
                min={0}
                max={1}
                step={0.05}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            <CardDescription>Pre-filter catalog before ranking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Category Filter</Label>
                <p className="text-xs text-muted-foreground">
                  Only match within the detected furniture category
                </p>
              </div>
              <Switch checked={true} onCheckedChange={() => {}} disabled />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Price Range</Label>
                  <p className="text-xs text-muted-foreground">
                    Limit results to a specific range
                  </p>
                </div>
                <Switch
                  checked={config.priceRangeEnabled}
                  onCheckedChange={(c) => handleSwitchChange("priceRangeEnabled", c)}
                />
              </div>
              {config.priceRangeEnabled && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="priceRangeMin" className="text-xs">Min ($)</Label>
                      <Input
                        id="priceRangeMin"
                        type="number"
                        min={0}
                        value={config.priceRangeMin}
                        onChange={(e) => handlePriceRangeChange("priceRangeMin", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="priceRangeMax" className="text-xs">Max ($)</Label>
                      <Input
                        id="priceRangeMax"
                        type="number"
                        min={config.priceRangeMin}
                        value={config.priceRangeMax}
                        onChange={(e) => handlePriceRangeChange("priceRangeMax", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                  </div>
                  {config.priceRangeMin >= config.priceRangeMax && (
                    <p className="text-xs text-red-600">Min must be less than Max</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 border-2 shadow-lg">
          <CardHeader>
            <CardTitle>Backend Configuration</CardTitle>
            <CardDescription>API endpoint settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="backendUrl">Backend Base URL</Label>
              <Input
                id="backendUrl"
                type="text"
                value={config.backendUrl}
                onChange={(e) => setConfig({ ...config, backendUrl: e.target.value })}
                placeholder="http://localhost:4000"
                className="max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Where the React client sends search requests. Useful if you run the API on a different host or port.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={handleReset} className="shadow-sm">
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
