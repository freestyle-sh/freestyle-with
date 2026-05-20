import type { VmWith, VmWithInstance } from "freestyle";

export type ComputerUseCoordinate = [number, number];
export type ComputerUseRegion = [number, number, number, number];
export type ComputerUseScrollDirection = "up" | "down" | "left" | "right";
export type ComputerUseToolType =
  | "computer_20241022"
  | "computer_20250124"
  | "computer_20251124";
export type ComputerUseAllowedCaller =
  | "direct"
  | "code_execution_20250825"
  | "code_execution_20260120";

export type ComputerUseCacheControlEphemeral = {
  type: "ephemeral";
  ttl?: "5m" | "1h";
};

export type ComputerUseToolOptions = {
  type?: ComputerUseToolType;
  allowed_callers?: ComputerUseAllowedCaller[];
  cache_control?: ComputerUseCacheControlEphemeral | null;
  defer_loading?: boolean;
  display_number?: number | null;
  enable_zoom?: boolean;
  input_examples?: Array<Record<string, unknown>>;
  strict?: boolean;
};

export type ComputerUseToolDefinitionBase<TType extends ComputerUseToolType> = {
  display_height_px: number;
  display_width_px: number;
  name: "computer";
  type: TType;
  allowed_callers?: ComputerUseAllowedCaller[];
  cache_control?: ComputerUseCacheControlEphemeral | null;
  defer_loading?: boolean;
  display_number?: number | null;
  input_examples?: Array<Record<string, unknown>>;
  strict?: boolean;
};

export type ComputerUseToolDefinition20241022 =
  ComputerUseToolDefinitionBase<"computer_20241022">;

export type ComputerUseToolDefinition20250124 =
  ComputerUseToolDefinitionBase<"computer_20250124">;

export type ComputerUseToolDefinition20251124 =
  ComputerUseToolDefinitionBase<"computer_20251124"> & {
    enable_zoom?: boolean;
  };

export type ComputerUseToolDefinition =
  | ComputerUseToolDefinition20241022
  | ComputerUseToolDefinition20250124
  | ComputerUseToolDefinition20251124;

export type ComputerUseScreenshotAction = {
  action: "screenshot";
};

export type ComputerUseCursorPositionAction = {
  action: "cursor_position";
};

export type ComputerUseMouseMoveAction = {
  action: "mouse_move";
  coordinate: ComputerUseCoordinate;
};

export type ComputerUseClickAction = {
  action:
    | "left_click"
    | "right_click"
    | "middle_click"
    | "double_click"
    | "triple_click";
  coordinate?: ComputerUseCoordinate;
  key?: string;
};

export type ComputerUseLeftClickDragAction = {
  action: "left_click_drag";
  start_coordinate: ComputerUseCoordinate;
  coordinate: ComputerUseCoordinate;
};

export type ComputerUseTypeAction = {
  action: "type";
  text: string;
};

export type ComputerUseKeyAction = {
  action: "key";
  text: string;
};

export type ComputerUseLeftMouseAction = {
  action: "left_mouse_down" | "left_mouse_up";
};

export type ComputerUseScrollAction = {
  action: "scroll";
  scroll_direction: ComputerUseScrollDirection;
  scroll_amount: number;
  coordinate?: ComputerUseCoordinate;
  text?: string;
};

export type ComputerUseHoldKeyAction = {
  action: "hold_key";
  text: string;
  duration: number;
};

export type ComputerUseWaitAction = {
  action: "wait";
  duration: number;
};

export type ComputerUseZoomAction = {
  action: "zoom";
  region: ComputerUseRegion;
};

export type ComputerUseAction =
  | ComputerUseScreenshotAction
  | ComputerUseCursorPositionAction
  | ComputerUseMouseMoveAction
  | ComputerUseClickAction
  | ComputerUseLeftClickDragAction
  | ComputerUseTypeAction
  | ComputerUseKeyAction
  | ComputerUseLeftMouseAction
  | ComputerUseScrollAction
  | ComputerUseHoldKeyAction
  | ComputerUseWaitAction
  | ComputerUseZoomAction;

export type ComputerUseScreenshot = {
  mimeType: "image/png";
  data: string;
  width: number;
  height: number;
};

export type ComputerUseResult = {
  success: boolean;
  output?: string;
  error?: string;
  base64_image?: string;
  stdout?: string;
  stderr?: string;
};

export type ComputerUseDisplaySize = {
  width: number;
  height: number;
};

export type ComputerUsePoint = {
  x: number;
  y: number;
};

export type ComputerUseMouseButton = "left" | "middle" | "right";

export type ComputerUseClickOptions = ComputerUsePoint & {
  button?: ComputerUseMouseButton;
};

export type ComputerUseDoubleClickOptions = ComputerUseClickOptions & {
  delayMs?: number;
};

export type ComputerUseMoveOptions = ComputerUsePoint;

export type ComputerUseDragOptions = {
  from: ComputerUsePoint;
  to: ComputerUsePoint;
  button?: ComputerUseMouseButton;
};

export type ComputerUseScrollOptions = Partial<ComputerUsePoint> & {
  deltaX?: number;
  deltaY?: number;
};

export type ComputerUseTypeOptions = {
  text: string;
  delayMs?: number;
};

export type ComputerUseKeyOptions = {
  keys: string | string[];
};

export type ComputerUseActionResult = ComputerUseResult;

export interface VmComputerUse<
  T extends VmComputerUseInstance = VmComputerUseInstance,
> extends VmWith<T> {}

export interface VmComputerUseInstance extends VmWithInstance {
  computerUseTool(
    options?: ComputerUseToolOptions,
  ): Promise<ComputerUseToolDefinition>;
  computerUse(action: ComputerUseAction): Promise<ComputerUseResult>;
  getDisplaySize(): Promise<ComputerUseDisplaySize>;
  screenshot(options?: { path?: string }): Promise<ComputerUseScreenshot>;
  click(options: ComputerUseClickOptions): Promise<ComputerUseActionResult>;
  doubleClick(
    options: ComputerUseDoubleClickOptions,
  ): Promise<ComputerUseActionResult>;
  move(options: ComputerUseMoveOptions): Promise<ComputerUseActionResult>;
  drag(options: ComputerUseDragOptions): Promise<ComputerUseActionResult>;
  scroll(options: ComputerUseScrollOptions): Promise<ComputerUseActionResult>;
  type(options: ComputerUseTypeOptions): Promise<ComputerUseActionResult>;
  key(options: ComputerUseKeyOptions): Promise<ComputerUseActionResult>;
}
