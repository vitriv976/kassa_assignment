import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "./ui/dialog"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Eye, EyeOff } from "lucide-react"
import { useApiKeys } from "../state/ApiKeysContext"

interface ApiKeyModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApiKeyModal({ open, onOpenChange }: ApiKeyModalProps) {
  const { apiKeys, setApiKey, getApiKey } = useApiKeys()
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [tempKeys, setTempKeys] = useState<Record<string, string>>({
    openai: apiKeys.openai || "",
    anthropic: apiKeys.anthropic || "",
    google: apiKeys.google || "",
    embedding: apiKeys.embedding || "",
  })

  useEffect(() => {
    if (open) {
      setTempKeys({
        openai: apiKeys.openai || "",
        anthropic: apiKeys.anthropic || "",
        google: apiKeys.google || "",
        embedding: apiKeys.embedding || "",
      })
      setShowKeys({})
    }
  }, [open, apiKeys])

  const handleSave = () => {
    setApiKey("openai", tempKeys.openai)
    setApiKey("anthropic", tempKeys.anthropic)
    setApiKey("google", tempKeys.google)
    setApiKey("embedding", tempKeys.embedding)
    onOpenChange(false)
  }

  const toggleShowKey = (provider: string) => {
    setShowKeys((prev) => ({ ...prev, [provider]: !prev[provider] }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>API Key Configuration</DialogTitle>
          <DialogDescription>
            Enter API keys for your AI providers. Keys are stored in memory only and never persisted to disk.
            You only need to provide keys for the providers you want to use.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="openai-key"
                type={showKeys.openai ? "text" : "password"}
                placeholder="sk-..."
                value={tempKeys.openai}
                onChange={(e) => setTempKeys((prev) => ({ ...prev, openai: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey("openai")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.openai ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Required for OpenAI vision and embeddings</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="anthropic-key">Anthropic API Key</Label>
            <div className="relative">
              <Input
                id="anthropic-key"
                type={showKeys.anthropic ? "text" : "password"}
                placeholder="sk-ant-..."
                value={tempKeys.anthropic}
                onChange={(e) => setTempKeys((prev) => ({ ...prev, anthropic: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey("anthropic")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.anthropic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">For Claude vision models (embeddings require OpenAI key)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="google-key">Google API Key</Label>
            <div className="relative">
              <Input
                id="google-key"
                type={showKeys.google ? "text" : "password"}
                placeholder="AIza..."
                value={tempKeys.google}
                onChange={(e) => setTempKeys((prev) => ({ ...prev, google: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey("google")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.google ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">For Gemini vision and embeddings</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="embedding-key">Embedding API Key (Optional)</Label>
            <div className="relative">
              <Input
                id="embedding-key"
                type={showKeys.embedding ? "text" : "password"}
                placeholder="Use separate key for embeddings..."
                value={tempKeys.embedding}
                onChange={(e) => setTempKeys((prev) => ({ ...prev, embedding: e.target.value }))}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => toggleShowKey("embedding")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKeys.embedding ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Optional: Use a different key for embeddings (useful when using Anthropic for vision)</p>
          </div>

          <p className="text-xs text-muted-foreground pt-2 border-t">
            All keys are stored in browser memory only and will be cleared when you close the tab.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Keys
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
