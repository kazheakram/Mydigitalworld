// Small pieces shared by both backends (kept separate to avoid circular imports).
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

let previewAsPublic = false;
export const setPreviewAsPublic = (v: boolean) => { previewAsPublic = v; };
export const isPreviewingPublic = () => previewAsPublic;
