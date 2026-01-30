import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Integration } from '@/types';
import { Settings, Check, AlertCircle } from 'lucide-react';

interface IntegrationCardProps {
  integration: Integration;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (integration: Integration) => void;
  disabled?: boolean;
}

const IntegrationCard = ({ integration, onToggle, onEdit, disabled }: IntegrationCardProps) => {
  const needsEmail = integration.configFields?.includes('email');
  const needsApiKey = integration.requiresKey || integration.configFields?.includes('apiKey');
  const hasEmail = !!integration.email;
  const hasApiKey = !!integration.apiKey;

  // Check if configuration is complete
  const isConfigured = (!needsEmail || hasEmail) && (!needsApiKey || hasApiKey);
  const needsConfig = (needsEmail && !hasEmail) || (needsApiKey && !hasApiKey);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border p-5 rounded bg-card hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{integration.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">{integration.name}</h3>
              {integration.enabled && needsConfig && (
                <span className="flex items-center gap-1 text-xs text-amber-500">
                  <AlertCircle className="w-3 h-3" />
                  Needs config
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
              {integration.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(integration)}
            className="h-8 w-8"
            disabled={disabled}
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Switch
            checked={integration.enabled}
            onCheckedChange={(checked) => onToggle(integration.id, checked)}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Configuration Status */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {integration.apiUrl && (
          <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
            {integration.apiUrl}
          </span>
        )}
        {needsEmail && (
          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
            hasEmail ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
          }`}>
            {hasEmail && <Check className="w-3 h-3" />}
            Email {hasEmail ? 'configured' : 'optional'}
          </span>
        )}
        {needsApiKey && (
          <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
            hasApiKey ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'
          }`}>
            {hasApiKey && <Check className="w-3 h-3" />}
            API Key {hasApiKey ? 'set' : (integration.requiresKey ? 'required' : 'optional')}
          </span>
        )}
        {!needsEmail && !needsApiKey && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 flex items-center gap-1">
            <Check className="w-3 h-3" />
            No API key required
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default IntegrationCard;
