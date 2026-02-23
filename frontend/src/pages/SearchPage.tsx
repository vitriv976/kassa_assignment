import { useState } from "react";
import { useSearchConfig } from "../state/SearchConfigContext";
import { useEvaluation } from "../state/EvaluationContext";
import { useSearchHistory, type ScoredProduct } from "../state/SearchHistoryContext";
import { useApiKeys } from "../state/ApiKeysContext";
import { useToast } from "../components/ui/toast";
import { searchApi } from "../services/searchApi";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Skeleton } from "../components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Upload, Search, CheckCircle2, XCircle, Loader2, Info, X, History, Clock } from "lucide-react";

interface SearchPageProps {
  onOpenApiKeyModal: () => void;
}

export function SearchPage({ onOpenApiKeyModal }: SearchPageProps) {
  const { config } = useSearchConfig();
  const { addRecord } = useEvaluation();
  const { history, addHistory } = useSearchHistory();
  const { apiKeys, getApiKey } = useApiKeys();
  const { addToast } = useToast();

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScoredProduct[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "history">("search");
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleImageChange = (file: File | null) => {
    if (!file) {
      setImagePreview(null);
      setImageBase64(null);
      return;
    }
    processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const provider = config.aiProvider || "openai";
    const visionApiKey = getApiKey(provider as any);
    
    if (!visionApiKey) {
      setError(`Please configure your ${provider} API key first.`);
      onOpenApiKeyModal();
      return;
    }
    if (!imageBase64) {
      setError("Please upload an image.");
      return;
    }
    setError(null);
    setLoading(true);
    setSelectedHistoryItem(null);
    try {
      const response = await searchApi.search({
        backendUrl: config.backendUrl,
        apiKeys,
        imageBase64,
        queryText: queryText || undefined,
        config,
      });
      setResults(response.results);
      addHistory({
        queryText: queryText || undefined,
        imagePreview: imagePreview || undefined,
        imageBase64: imageBase64 || undefined,
        results: response.results,
        resultsCount: response.results.length,
        isFurniture: response.isFurniture,
        rejectionReason: response.debug?.rejectionReason,
      });
      setActiveTab("search");
      
      // Show appropriate notifications based on results
      if (!response.isFurniture) {
        const reason = response.debug?.rejectionReason || "The uploaded image does not appear to be furniture.";
        addToast({
          title: "Not a furniture item",
          description: reason,
          variant: "error",
        });
      } else if (response.results.length === 0) {
        addToast({
          title: "No matching products found",
          description: "We couldn't find any furniture products matching your image. Try uploading a different furniture image.",
          variant: "info",
        });
      } else {
        addToast({
          title: "Search completed",
          description: `Found ${response.results.length} matching product${response.results.length !== 1 ? 's' : ''}`,
          variant: "success",
        });
      }
    } catch (err: any) {
      setError(err?.message ?? "Search failed");
      addToast({
        title: "Search failed",
        description: err?.message ?? "Please try again",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkRelevant = (productId: string, relevant: boolean, score?: number, rank?: number) => {
    // Find the current search in history to get searchId
    const currentSearch = history[0]; // Most recent search
    addRecord({ 
      productId, 
      relevant,
      score,
      rank,
      searchId: currentSearch?.id,
    });
    addToast({
      title: relevant ? "Marked as relevant" : "Marked as not relevant",
      description: "Your feedback has been recorded",
      variant: "success",
    });
  };

  const handleClearImage = () => {
    setImagePreview(null);
    setImageBase64(null);
  };

  const handleHistoryClick = (item: typeof history[0]) => {
    setSelectedHistoryItem(item.id);
    // Stay in history tab, just update selected item
  };

  const getMatchBadgeVariant = (score: number) => {
    if (score >= 0.8) return "default";
    if (score >= 0.6) return "secondary";
    return "outline";
  };

  const getMatchColor = (score: number) => {
    if (score >= 0.8) return "text-green-600";
    if (score >= 0.6) return "text-blue-600";
    return "text-muted-foreground";
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "history")}>
        <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
          <TabsTrigger value="search">
            <Search className="h-4 w-4 mr-2" />
            Search
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="space-y-6 mt-6">
          <Card className="border-2 shadow-lg">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Product Image</Label>
                  {!imagePreview ? (
                    <div className="flex items-center justify-center w-full">
                      <label
                        htmlFor="image-upload"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex flex-col items-center justify-center w-full h-72 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                          isDragging
                            ? "border-primary bg-primary/10 scale-[1.02] shadow-lg"
                            : "bg-gradient-to-br from-muted/30 to-muted/50 hover:from-muted/40 hover:to-muted/60 border-muted-foreground/25 hover:border-primary/50"
                        }`}
                      >
                        <div className="flex flex-col items-center justify-center py-12">
                          <div className="rounded-full bg-primary/10 p-5 mb-4 shadow-inner">
                            <Upload className="w-10 h-10 text-primary" />
                          </div>
                          <p className="mb-2 text-lg font-semibold text-foreground">
                            Drag & drop or click to upload
                          </p>
                          <p className="text-sm text-muted-foreground">PNG, JPG, WEBP up to 10MB</p>
                        </div>
                        <input
                          id="image-upload"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleImageChange(e.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className="relative w-full max-w-2xl mx-auto rounded-xl overflow-hidden border-2 border-border shadow-xl">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-auto max-h-96 object-contain bg-gradient-to-br from-muted/20 to-muted/40"
                        />
                        <button
                          type="button"
                          onClick={handleClearImage}
                          className="absolute top-3 right-3 p-2 bg-background/95 hover:bg-background rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="query-text" className="text-base font-semibold">Refine search (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="query-text"
                      placeholder='e.g. "blue velvet under $500"'
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="flex-1 h-11"
                    />
                    <Button type="submit" disabled={loading || !getApiKey((config.aiProvider || "openai") as any) || !imageBase64} size="lg" className="px-6">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Searching...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Search
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                    {error}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {loading && (
            <Card className="border-2 shadow-lg">
              <CardContent className="pt-6">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 mb-6 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 bg-blue-600 rounded-full animate-pulse" />
                    <div>
                      <p className="font-semibold text-blue-900">Analyzing your image...</p>
                      <p className="text-sm text-blue-700">Identifying furniture characteristics and searching the catalog</p>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="border">
                      <CardContent className="pt-6 space-y-3">
                        <Skeleton className="h-48 w-full rounded-lg" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{results.length} products found</h2>
                {queryText && (
                  <Badge variant="outline" className="text-sm px-3 py-1">
                    {queryText}
                  </Badge>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-h-[calc(100vh-500px)] overflow-y-auto pr-2 custom-scrollbar">
                {results.map((item, index) => (
                  <Card key={item.product._id} className="flex flex-col hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                        <Badge variant={getMatchBadgeVariant(item.score)} className={getMatchColor(item.score)}>
                          {(item.score * 100).toFixed(0)}% match
                        </Badge>
                      </div>
                      <CardTitle className="text-lg line-clamp-2">{item.product.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.product.description}
                      </p>
                      {item.explanation && (
                        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                          <p className="text-xs text-blue-900">{item.explanation}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm pt-2 border-t">
                        <div>
                          <span className="text-muted-foreground">{item.product.category}</span>
                        </div>
                        <div className="font-semibold">${item.product.price.toFixed(2)}</div>
                        <div className="text-muted-foreground">
                          {item.product.width} × {item.product.depth} × {item.product.height} cm
                        </div>
                      </div>
                    </CardContent>
                    <CardContent className="pt-0">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                          onClick={() => handleMarkRelevant(item.product._id, true, item.score, index + 1)}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Relevant
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                          onClick={() => handleMarkRelevant(item.product._id, false, item.score, index + 1)}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Not relevant
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {!loading && results.length === 0 && (
            <Card className="border-2 shadow-lg">
              <CardContent className="pt-12 pb-12">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="h-24 w-24 rounded-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shadow-inner">
                    <Search className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {selectedHistoryItem ? "No results found" : "No results yet"}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      {selectedHistoryItem
                        ? "This search didn't find any matching furniture products. The image may not be furniture, or there are no similar items in the catalog."
                        : "Upload an image of a furniture item to find matching products from the catalog. You can also add a text query to refine your search."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <div className="space-y-6">
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <CardTitle>Search History</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No search history yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((item) => (
                      <Card
                        key={item.id}
                        className={`hover:bg-muted/50 transition-all cursor-pointer border-2 ${
                          selectedHistoryItem === item.id ? "border-primary shadow-md" : "hover:border-primary/30"
                        }`}
                        onClick={() => handleHistoryClick(item)}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-4">
                            {item.imagePreview && (
                              <div className="w-24 h-24 rounded-lg overflow-hidden border-2 shrink-0 shadow-sm">
                                <img
                                  src={item.imagePreview}
                                  alt="Search"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {item.queryText && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.queryText}
                                  </Badge>
                                )}
                                {item.isFurniture === false && (
                                  <Badge variant="destructive" className="text-xs">
                                    Not Furniture
                                  </Badge>
                                )}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {new Date(item.timestamp).toLocaleString()}
                                </div>
                              </div>
                              {item.isFurniture === false && item.rejectionReason && (
                                <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                                  <p className="text-xs text-destructive font-medium">Rejection Reason:</p>
                                  <p className="text-xs text-destructive/80 mt-1">{item.rejectionReason}</p>
                                </div>
                              )}
                              <p className="text-sm font-medium">
                                {item.isFurniture === false ? (
                                  <span className="text-destructive">No furniture detected</span>
                                ) : (
                                  <>
                                    Found <span className="font-bold text-primary">{item.resultsCount}</span> products
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Show selected history item results */}
            {selectedHistoryItem && (
              <>
                {(() => {
                  const selectedItem = history.find((item) => item.id === selectedHistoryItem);
                  if (!selectedItem) return null;
                  
                  if (selectedItem.isFurniture === false) {
                    return (
                      <Card className="border-2 shadow-lg border-destructive/20">
                        <CardHeader>
                          <CardTitle className="text-destructive">Not a Furniture Item</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {selectedItem.imagePreview && (
                              <div className="max-w-md mx-auto rounded-lg overflow-hidden border-2 border-destructive/30">
                                <img
                                  src={selectedItem.imagePreview}
                                  alt="Uploaded image"
                                  className="w-full h-auto"
                                />
                              </div>
                            )}
                            {selectedItem.rejectionReason && (
                              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <p className="font-semibold text-destructive mb-2">Rejection Reason:</p>
                                <p className="text-sm text-destructive/90">{selectedItem.rejectionReason}</p>
                              </div>
                            )}
                            {selectedItem.queryText && (
                              <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium mb-1">Query:</p>
                                <p className="text-sm text-muted-foreground">{selectedItem.queryText}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  if (selectedItem.results.length === 0) {
                    return (
                      <Card className="border-2 shadow-lg">
                        <CardHeader>
                          <CardTitle>No Results Found</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {selectedItem.imagePreview && (
                              <div className="max-w-md mx-auto rounded-lg overflow-hidden border-2">
                                <img
                                  src={selectedItem.imagePreview}
                                  alt="Search"
                                  className="w-full h-auto"
                                />
                              </div>
                            )}
                            <p className="text-center text-muted-foreground">
                              This search didn't find any matching furniture products.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  return (
                    <Card className="border-2 shadow-lg">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Search Results ({selectedItem.results.length})</span>
                          {selectedItem.queryText && (
                            <Badge variant="secondary" className="text-sm">
                              "{selectedItem.queryText}"
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {selectedItem.results.map((item, index) => (
                              <Card key={item.product._id} className="flex flex-col hover:shadow-xl transition-shadow duration-200">
                                <CardHeader className="pb-3">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                                    <Badge variant={getMatchBadgeVariant(item.score)} className={getMatchColor(item.score)}>
                                      {(item.score * 100).toFixed(0)}% match
                                    </Badge>
                                  </div>
                                  <CardTitle className="text-lg line-clamp-2">{item.product.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-1 space-y-3">
                                  <p className="text-sm text-muted-foreground line-clamp-2">
                                    {item.product.description}
                                  </p>
                                  {item.explanation && (
                                    <div className="flex items-start gap-2 p-2 bg-blue-50 rounded-md">
                                      <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                                      <p className="text-xs text-blue-900">{item.explanation}</p>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-4 text-sm pt-2 border-t">
                                    <div>
                                      <span className="text-muted-foreground">{item.product.category}</span>
                                    </div>
                                    <div className="font-semibold">${item.product.price.toFixed(2)}</div>
                                    <div className="text-muted-foreground">
                                      {item.product.width} × {item.product.depth} × {item.product.height} cm
                                    </div>
                                  </div>
                                </CardContent>
                                <CardContent className="pt-0">
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="flex-1"
                                      onClick={() => handleMarkRelevant(item.product._id, true, item.score, index + 1)}
                                    >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Relevant
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="flex-1"
                                      onClick={() => handleMarkRelevant(item.product._id, false, item.score, index + 1)}
                                    >
                                      <XCircle className="mr-1 h-3 w-3" />
                                      Not relevant
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
