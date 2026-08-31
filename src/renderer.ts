type Annotation = _ZoteroTypes.Reader.Annotation;

interface PDFView extends _ZoteroTypes.Reader.PDFView {
  renderPageAnnotationsOnCanvas: (
    canvas: HTMLCanvasElement,
    viewport: unknown,
    pageIndex: number,
  ) => Promise<void>;
  _getPageAnnotations?: (pageIndex: number) => Annotation[];
  _render: (pageIndexes?: number[]) => void;
  _annotations: Annotation[];
  _pages: Page[];
}

interface Page extends _ZoteroTypes.Reader.Page {
  _layer: PDFView;
  _pageIndex: number;
  _originalPage: unknown;
  _pageRenderer: Renderer;
  _detailRenderer: Renderer;
  refresh(detailView: boolean): void;
  render(): void;
  renderAnnotationOnCanvas(
    annotation: Annotation,
    canvas: HTMLCanvasElement,
  ): void;
}

interface Renderer {
  _isDetailView: boolean;
  _layer: PDFView;
  _originalPage: unknown;
  _pageIndex: number;
  _snapshotCanvas: HTMLCanvasElement;
  _snapshotContext: CanvasRenderingContext2D;
  _context: CanvasRenderingContext2D | null;
  _lastSourceCanvas: HTMLCanvasElement | null;
  _lastSourceSize: { w: number; h: number };
  _lastRenderSignature: string | null;
  _isRendering: boolean;
  readonly _transform: number[];
  readonly _scale: number;
  _getSourceCanvas(): HTMLCanvasElement | undefined;
  _initContext(): void;
  _invalidateSignature(): void;
  _maybeRefreshSnapshot(): void;
  _getViewPoint(p: number[], tfm?: number[]): number[];
  _getPdfPoint(p: number[]): number[];
  _getViewRect(rect: number[], tfm?: number[]): number[];
  _buildRenderSignature(): string;
  _drawHover(): void;
  _drawOverlays(): void;
  _drawNoteIcon(ctx: CanvasRenderingContext2D, color: string): void;
  _drawCommentIcons(annotations: Annotation[]): void;
  _drawHighlight(annotation: Annotation): void;
  _drawUnderline(annotation: Annotation): void;
  _drawNote(annotation: Annotation): void;
  _drawImage(annotation: Annotation): void;
  _drawInk(annotation: Annotation): void;
  _drawFindResults(): void;
  _renderCommon(): void;
  render(): void;
  renderAnnotationOnCanvas(
    annotation: Annotation,
    canvas: HTMLCanvasElement,
  ): void;
}

function monkeyPatchRenderer(page: Page): void {
  const renderer = page._pageRenderer;
  const context = renderer._context;
  if (!context) return;

  const _renderCommon = renderer._renderCommon.bind(renderer);
  renderer._renderCommon = function (...args) {
    const drawImage = context.drawImage.bind(context);
    context.drawImage = function () {
      context.filter = 'contrast(250%)';
      drawImage.apply(context, arguments);
      context.filter = 'none';
    };
    _renderCommon(...args);
    context.drawImage = drawImage;
  };
}
