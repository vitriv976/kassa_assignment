import { useEvaluation } from "../state/EvaluationContext";
import { useSearchHistory } from "../state/SearchHistoryContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, Info, Target, Award, AlertCircle, HelpCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

export function EvaluationPage() {
  const { records } = useEvaluation();
  const { history } = useSearchHistory();
  const [selectedTab, setSelectedTab] = useState<"overview" | "details" | "insights">("overview");

  // Deduplicate by productId, keeping the latest judgment
  const uniqueRecords = useMemo(() => {
    const map = new Map<string, typeof records[0]>();
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
    for (const record of sorted) {
      if (!map.has(record.productId)) {
        map.set(record.productId, record);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [records]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = uniqueRecords.length;
    const relevant = uniqueRecords.filter((r) => r.relevant).length;
    const notRelevant = total - relevant;
    const precision = total > 0 ? relevant / total : 0;

    // Precision@K - precision at different result positions
    const precisionAtK: Record<number, number> = {};
    for (const k of [1, 3, 5, 10]) {
      const topK = uniqueRecords.filter((r) => (r.rank || 999) <= k);
      const relevantInK = topK.filter((r) => r.relevant).length;
      precisionAtK[k] = topK.length > 0 ? relevantInK / topK.length : 0;
    }

    // Score distribution
    const withScores = uniqueRecords.filter((r) => r.score !== undefined);
    const relevantScores = withScores.filter((r) => r.relevant).map((r) => r.score!);
    const notRelevantScores = withScores.filter((r) => !r.relevant).map((r) => r.score!);

    const avgRelevantScore = relevantScores.length > 0
      ? relevantScores.reduce((a, b) => a + b, 0) / relevantScores.length
      : 0;
    const avgNotRelevantScore = notRelevantScores.length > 0
      ? notRelevantScores.reduce((a, b) => a + b, 0) / notRelevantScores.length
      : 0;

    // Category breakdown
    const categoryMap = new Map<string, { total: number; relevant: number }>();
    for (const record of uniqueRecords) {
      // Try to find product in search history
      const searchItem = history.find((h) => h.id === record.searchId);
      const product = searchItem?.results.find((r) => r.product._id === record.productId);
      if (product) {
        const category = product.product.category;
        const current = categoryMap.get(category) || { total: 0, relevant: 0 };
        current.total++;
        if (record.relevant) current.relevant++;
        categoryMap.set(category, current);
      }
    }

    // Recent trend (last 10 judgments)
    const recent = uniqueRecords.slice(0, 10);
    const recentRelevant = recent.filter((r) => r.relevant).length;
    const recentPrecision = recent.length > 0 ? recentRelevant / recent.length : 0;

    return {
      total,
      relevant,
      notRelevant,
      precision,
      precisionAtK,
      avgRelevantScore,
      avgNotRelevantScore,
      categoryMap,
      recentPrecision,
      withScores: withScores.length,
    };
  }, [uniqueRecords, history]);

  // Helper component for metric card
  const MetricCard = ({ 
    title, 
    value, 
    subtitle, 
    icon: Icon, 
    trend, 
    helpText 
  }: { 
    title: string; 
    value: string | number; 
    subtitle?: string;
    icon?: typeof BarChart3;
    trend?: "up" | "down" | "neutral";
    helpText?: string;
  }) => {
    const [showHelp, setShowHelp] = useState(false);
    return (
      <Card className="relative">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              {helpText && (
                <div className="relative">
                  <HelpCircle 
                    className="h-3 w-3 text-muted-foreground cursor-help" 
                    onMouseEnter={() => setShowHelp(true)}
                    onMouseLeave={() => setShowHelp(false)}
                  />
                  {showHelp && (
                    <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-popover border rounded-md shadow-lg text-xs">
                      {helpText}
                    </div>
                  )}
                </div>
              )}
            </div>
            {trend && (
              <div className={`flex items-center gap-1 ${trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : ""}`}>
                {trend === "up" && <TrendingUp className="h-4 w-4" />}
                {trend === "down" && <TrendingDown className="h-4 w-4" />}
              </div>
            )}
          </div>
          <p className="text-3xl font-bold">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Search Quality Evaluation
        </h1>
        <p className="text-muted-foreground">
          Analyze how well the search system is performing based on your relevance judgments
        </p>
      </div>

      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mx-auto">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="details">
            <Target className="h-4 w-4 mr-2" />
            Details
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Award className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              title="Total Evaluated"
              value={metrics.total}
              subtitle={`${records.length} total judgments`}
              icon={BarChart3}
              helpText="Number of unique products you've evaluated. Each product is counted once (latest judgment)."
            />
            <MetricCard
              title="Relevant"
              value={metrics.relevant}
              subtitle={`${((metrics.relevant / metrics.total) * 100 || 0).toFixed(1)}% of total`}
              icon={Award}
              helpText="Products you marked as relevant matches. Higher is better."
            />
            <MetricCard
              title="Not Relevant"
              value={metrics.notRelevant}
              subtitle={`${((metrics.notRelevant / metrics.total) * 100 || 0).toFixed(1)}% of total`}
              icon={AlertCircle}
              helpText="Products you marked as not relevant. Lower is better."
            />
            <MetricCard
              title="Overall Precision"
              value={`${(metrics.precision * 100).toFixed(1)}%`}
              subtitle={metrics.recentPrecision > metrics.precision ? "Improving" : metrics.recentPrecision < metrics.precision ? "Declining" : "Stable"}
              icon={Target}
              trend={metrics.recentPrecision > metrics.precision ? "up" : metrics.recentPrecision < metrics.precision ? "down" : "neutral"}
              helpText="Precision = Relevant / Total. Measures how many of the returned results are actually relevant. Higher is better (closer to 100%)."
            />
          </div>

          {/* Precision@K */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                <CardTitle>Precision at K (Top Results)</CardTitle>
              </div>
              <CardDescription>
                Precision calculated for the top K results. This shows how well the system ranks relevant items.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 3, 5, 10].map((k) => {
                  const precision = metrics.precisionAtK[k];
                  const topKRecords = uniqueRecords.filter((r) => (r.rank || 999) <= k);
                  return (
                    <div key={k} className="text-center p-4 border rounded-lg">
                      <p className="text-sm text-muted-foreground mb-1">Precision@{k}</p>
                      <p className="text-2xl font-bold">{precision > 0 ? (precision * 100).toFixed(1) : "—"}%</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {topKRecords.filter((r) => r.relevant).length} / {topKRecords.length} relevant
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-900">
                    <strong>What is Precision@K?</strong> This measures precision when looking at only the top K results. 
                    For example, Precision@5 shows how many of the top 5 results are relevant. 
                    Higher values mean the system is better at ranking relevant items first.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Score Analysis */}
          {metrics.withScores > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <CardTitle>Score Analysis</CardTitle>
                </div>
                <CardDescription>
                  How relevance scores differ between relevant and not relevant products
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Average Score (Relevant)</p>
                    <p className="text-2xl font-bold text-green-600">
                      {metrics.avgRelevantScore.toFixed(3)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {uniqueRecords.filter((r) => r.relevant && r.score !== undefined).length} products
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground mb-2">Average Score (Not Relevant)</p>
                    <p className="text-2xl font-bold text-red-600">
                      {metrics.avgNotRelevantScore.toFixed(3)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {uniqueRecords.filter((r) => !r.relevant && r.score !== undefined).length} products
                    </p>
                  </div>
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-900">
                      <strong>Score Gap:</strong> A larger difference between relevant and not relevant scores indicates 
                      the ranking system is working well. If scores are similar, consider adjusting weights in the Admin page.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Breakdown */}
          {metrics.categoryMap.size > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance by Category</CardTitle>
                <CardDescription>
                  How well the system performs for different furniture categories
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from(metrics.categoryMap.entries())
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([category, data]) => {
                      const precision = data.total > 0 ? data.relevant / data.total : 0;
                      return (
                        <div key={category} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium capitalize">{category}</span>
                            <Badge variant={precision >= 0.7 ? "default" : precision >= 0.5 ? "secondary" : "outline"}>
                              {(precision * 100).toFixed(0)}% precision
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{data.relevant} relevant</span>
                            <span>•</span>
                            <span>{data.total - data.relevant} not relevant</span>
                            <span>•</span>
                            <span>{data.total} total</span>
                          </div>
                          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-600 transition-all"
                              style={{ width: `${precision * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Judgments</CardTitle>
              <CardDescription>
                Complete list of all your relevance judgments. Products are shown with their latest judgment.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {uniqueRecords.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-2">No evaluation records yet</p>
                  <p className="text-sm">
                    Mark results as relevant or not relevant on the Search tab to start evaluating.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-semibold">Product ID</th>
                        <th className="text-left p-3 font-semibold">Relevant?</th>
                        <th className="text-left p-3 font-semibold">Score</th>
                        <th className="text-left p-3 font-semibold">Rank</th>
                        <th className="text-left p-3 font-semibold">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueRecords.map((r) => {
                        return (
                          <tr key={r.id} className="border-b hover:bg-muted/50">
                            <td className="p-3 font-mono text-xs max-w-xs truncate">{r.productId}</td>
                            <td className="p-3">
                              <Badge variant={r.relevant ? "default" : "secondary"}>
                                {r.relevant ? "Yes" : "No"}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {r.score !== undefined ? (
                                <span className="font-mono">{(r.score * 100).toFixed(1)}%</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3">
                              {r.rank ? (
                                <Badge variant="outline">#{r.rank}</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {new Date(r.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Evaluation Insights</CardTitle>
              <CardDescription>
                Recommendations and observations based on your evaluation data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.total === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Start evaluating search results to see insights here.</p>
                </div>
              ) : (
                <>
                  {metrics.precision < 0.5 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-red-900 mb-1">Low Precision Detected</p>
                          <p className="text-sm text-red-800">
                            Your precision is {(metrics.precision * 100).toFixed(1)}%, which means less than half 
                            of the returned results are relevant. Consider:
                          </p>
                          <ul className="text-sm text-red-800 mt-2 list-disc list-inside space-y-1">
                            <li>Increasing the <code className="bg-red-100 px-1 rounded">minScore</code> threshold in Admin settings</li>
                            <li>Adjusting the <code className="bg-red-100 px-1 rounded">imageWeight</code> and <code className="bg-red-100 px-1 rounded">textWeight</code> to better match your needs</li>
                            <li>Reducing <code className="bg-red-100 px-1 rounded">topK</code> to return fewer, higher-quality results</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {metrics.precision >= 0.7 && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Award className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-green-900 mb-1">Good Performance</p>
                          <p className="text-sm text-green-800">
                            Your precision is {(metrics.precision * 100).toFixed(1)}%, which indicates the search system 
                            is performing well. Most returned results are relevant to your queries.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {metrics.withScores > 0 && metrics.avgRelevantScore < metrics.avgNotRelevantScore && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-amber-900 mb-1">Score Ranking Issue</p>
                          <p className="text-sm text-amber-800">
                            Relevant products have lower average scores than not relevant ones. This suggests the 
                            ranking algorithm may need tuning. Try adjusting weights in the Admin page.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {metrics.precisionAtK[1] < 0.5 && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold text-blue-900 mb-1">Top Result Quality</p>
                          <p className="text-sm text-blue-800">
                            The top result is only relevant {(metrics.precisionAtK[1] * 100).toFixed(0)}% of the time. 
                            Consider increasing <code className="bg-blue-100 px-1 rounded">imageWeight</code> to improve 
                            visual similarity matching.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-muted/50 border rounded-lg">
                    <p className="font-semibold mb-2">How to Improve Search Quality</p>
                    <ul className="text-sm space-y-2 list-disc list-inside text-muted-foreground">
                      <li>Mark more results as relevant/not relevant to build a better evaluation dataset</li>
                      <li>Use the Admin page to experiment with different weight configurations</li>
                      <li>Try different AI models to see which performs best for your use case</li>
                      <li>Monitor Precision@K metrics to see how well top results are ranked</li>
                      <li>Check category breakdowns to identify categories that need improvement</li>
                    </ul>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
