import type { IssueAttachment } from '../hooks/useBoard';

/** Read a File as base64 (strips the data URL prefix). */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a single File attachment to an existing issue via the jellybean API.
 * Returns the newly created IssueAttachment entry.
 */
export async function uploadAttachmentToIssue(
  projectSlug: string,
  issueId: string,
  file: File,
  uploader: string,
  currentAttachments: IssueAttachment[]
): Promise<IssueAttachment> {
  const base64 = await readAsBase64(file);
  const uploadedAt = new Date().toISOString();
  const path = `attachments/${issueId}/${file.name}`;
  const entry: IssueAttachment = { name: file.name, path, uploadedBy: uploader, uploadedAt };
  const nextAttachments = [...currentAttachments, entry];

  const res = await fetch(`/api/jellybean/data/projects/${projectSlug}/issues/${issueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      _binaryUpload: { path, content: base64 },
      attachments: nextAttachments,
      activity: [{ type: 'attachment_added', by: uploader, at: uploadedAt }],
    }),
  });

  if (!res.ok) throw new Error(`Failed to upload ${file.name}`);
  return entry;
}
