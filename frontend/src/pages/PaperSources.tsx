import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, ChevronLeft, Database, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import IntegrationCard from '@/components/IntegrationCard';
import IntegrationModal from '@/components/IntegrationModal';
import { Integration } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';
import { useToast } from '@/hooks/use-toast';

// Sources enabled by default in demo mode
const DEMO_ENABLED_SOURCES = ['arxiv', 'semantic-scholar', 'openalex'];

const PaperSources = () => {
  // Check demo mode (frontend env var)
  const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const {
    integrations,
    toggleIntegration,
    updateIntegration,
    addIntegration,
  } = useSettings();

  // In demo mode, override enabled state to only show arxiv, semantic-scholar, openalex
  const displayIntegrations = demoMode
    ? integrations.map(int => ({
        ...int,
        enabled: DEMO_ENABLED_SOURCES.includes(int.id),
      }))
    : integrations;

  const [editingIntegration, setEditingIntegration] = useState<Integration | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewIntegration, setIsNewIntegration] = useState(false);
  const { toast } = useToast();

  const handleToggle = (id: string, enabled: boolean) => {
    toggleIntegration(id, enabled);
    const integration = displayIntegrations.find((int) => int.id === id);
    toast({
      title: enabled ? 'Integration Enabled' : 'Integration Disabled',
      description: `${integration?.name} has been ${enabled ? 'enabled' : 'disabled'}.`,
    });
  };

  const handleEdit = (integration: Integration) => {
    setEditingIntegration(integration);
    setIsNewIntegration(false);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingIntegration(null);
    setIsNewIntegration(true);
    setIsModalOpen(true);
  };

  const handleSave = (integration: Integration) => {
    if (isNewIntegration) {
      addIntegration(integration);
      toast({
        title: 'Integration Added',
        description: `${integration.name} has been added successfully.`,
      });
    } else {
      updateIntegration(integration);
      toast({
        title: 'Integration Updated',
        description: `${integration.name} has been updated.`,
      });
    }
  };

  const enabledCount = displayIntegrations.filter((int) => int.enabled).length;

  return (
    <div className="h-screen overflow-y-auto">
      <div className="p-6 border-b border-border">
        <Link
          to="/settings"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Settings
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Paper Sources</h2>
            <p className="text-sm text-muted-foreground">
              {enabledCount} of {displayIntegrations.length} sources active
            </p>
          </div>
          <div className="flex items-center gap-2">
            {demoMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = 'mailto:vishi.waffle@gmail.com?subject=Integration%20Request'}
              >
                <Mail className="w-4 h-4 mr-2" />
                Request Integration
              </Button>
            )}
            {!demoMode && (
              <Button onClick={handleAdd} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Source
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="p-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: {
              opacity: 1,
              transition: {
                staggerChildren: 0.1,
              },
            },
          }}
          className="grid gap-4"
        >
          {displayIntegrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onToggle={handleToggle}
              onEdit={handleEdit}
              disabled={demoMode}
            />
          ))}
        </motion.div>
      </div>

      <IntegrationModal
        integration={editingIntegration}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        isNew={isNewIntegration}
      />
    </div>
  );
};

export default PaperSources;
