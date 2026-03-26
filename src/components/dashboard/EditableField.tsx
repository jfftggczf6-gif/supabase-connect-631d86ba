import { type ReactNode } from 'react';
import DeliverableEditor from './DeliverableEditor';
import DeliverableReformulator from './DeliverableReformulator';
import { type PropagationResult } from '@/lib/field-propagation';

interface EditableFieldProps {
  /** The content to display */
  children: ReactNode;
  /** Required context for editing */
  enterpriseId: string;
  deliverableId: string;
  deliverableType: string;
  fieldPath: string;
  currentValue: any;
  /** 'text' shows both ✏️ edit + ✨ reformulate, 'number' shows only ✏️ edit */
  mode?: 'text' | 'number';
  /** Optional extra context for AI reformulation */
  reformulateContext?: string;
  /** Callback when value is saved */
  onSaved?: (newValue: any) => void;
  /** Callback when stale texts are detected after propagation */
  onStaleTextsFound?: (staleTexts: PropagationResult['staleTexts']) => void;
  /** Callback when text is reformulated */
  onReformulated?: (newText: string) => void;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

/**
 * Wraps any content with hover-to-edit (✏️) and hover-to-reformulate (✨) buttons.
 *
 * Usage:
 * <EditableField enterpriseId={id} deliverableId={did} deliverableType="business_plan"
 *   fieldPath="resume_gestion" currentValue={bp.resume_gestion} mode="text">
 *   <MultiText text={bp.resume_gestion} />
 * </EditableField>
 */
export default function EditableField({
  children,
  enterpriseId,
  deliverableId,
  deliverableType,
  fieldPath,
  currentValue,
  mode = 'number',
  reformulateContext,
  onSaved,
  onStaleTextsFound,
  onReformulated,
  className = '',
}: EditableFieldProps) {
  // Don't render edit controls if missing required props
  if (!enterpriseId || !deliverableId) {
    return <>{children}</>;
  }

  return (
    <div className={`group relative ${className}`}>
      {children}
      <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DeliverableEditor
          enterpriseId={enterpriseId}
          deliverableId={deliverableId}
          deliverableType={deliverableType}
          fieldPath={fieldPath}
          currentValue={currentValue}
          onSaved={onSaved}
          onStaleTextsFound={onStaleTextsFound}
        />
        {mode === 'text' && typeof currentValue === 'string' && currentValue.length > 0 && (
          <DeliverableReformulator
            enterpriseId={enterpriseId}
            deliverableId={deliverableId}
            deliverableType={deliverableType}
            fieldPath={fieldPath}
            currentText={currentValue}
            context={reformulateContext}
            onReformulated={onReformulated}
          />
        )}
      </div>
    </div>
  );
}
