export type AttachmentParentContext = {
  editionId: string;
  validationEditionId?: string | null;
  fundingLineEditionId?: string | null;
  deliverableEditionId?: string | null;
  conventionLinked?: boolean;
};

/** Every edition-scoped parent must resolve to the edition supplied as target. */
export function attachmentParentsAreConsistent(context: AttachmentParentContext): boolean {
  return [context.validationEditionId, context.fundingLineEditionId, context.deliverableEditionId]
    .filter((id): id is string => Boolean(id))
    .every((id) => id === context.editionId) && (context.conventionLinked ?? true);
}
