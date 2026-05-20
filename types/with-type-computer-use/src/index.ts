import type { VmWith, VmWithInstance } from "freestyle";

export type ComputerUseCoordinate = [number, number];
export type ComputerUseRegion = [number, number, number, number];
export type ComputerUseScrollDirection = "up" | "down" | "left" | "right";
export type AnthropicComputerUseCoordinate = ComputerUseCoordinate;
export type AnthropicComputerUseRegion = ComputerUseRegion;
export type AnthropicComputerUseScrollDirection = ComputerUseScrollDirection;

export type AnthropicComputerUseToolType =
  | "computer_20241022"
  | "computer_20250124"
  | "computer_20251124";
export type AnthropicComputerUseAllowedCaller =
  | "direct"
  | "code_execution_20250825"
  | "code_execution_20260120";

export type AnthropicComputerUseCacheControlEphemeral = {
  type: "ephemeral";
  ttl?: "5m" | "1h";
};

export type AnthropicComputerUseToolOptions = {
  type?: AnthropicComputerUseToolType;
  allowed_callers?: AnthropicComputerUseAllowedCaller[];
  cache_control?: AnthropicComputerUseCacheControlEphemeral | null;
  defer_loading?: boolean;
  display_number?: number | null;
  enable_zoom?: boolean;
  input_examples?: Array<Record<string, unknown>>;
  strict?: boolean;
};

export type AnthropicComputerUseToolDefinitionBase<
  TType extends AnthropicComputerUseToolType,
> = {
  display_height_px: number;
  display_width_px: number;
  name: "computer";
  type: TType;
  allowed_callers?: AnthropicComputerUseAllowedCaller[];
  cache_control?: AnthropicComputerUseCacheControlEphemeral | null;
  defer_loading?: boolean;
  display_number?: number | null;
  input_examples?: Array<Record<string, unknown>>;
  strict?: boolean;
};

export type AnthropicComputerUseToolDefinition20241022 =
  AnthropicComputerUseToolDefinitionBase<"computer_20241022">;

export type AnthropicComputerUseToolDefinition20250124 =
  AnthropicComputerUseToolDefinitionBase<"computer_20250124">;

export type AnthropicComputerUseToolDefinition20251124 =
  AnthropicComputerUseToolDefinitionBase<"computer_20251124"> & {
    enable_zoom?: boolean;
  };

export type AnthropicComputerUseToolDefinition =
  | AnthropicComputerUseToolDefinition20241022
  | AnthropicComputerUseToolDefinition20250124
  | AnthropicComputerUseToolDefinition20251124;

export type AnthropicComputerUseScreenshotAction = {
  action: "screenshot";
};

export type AnthropicComputerUseCursorPositionAction = {
  action: "cursor_position";
};

export type AnthropicComputerUseMouseMoveAction = {
  action: "mouse_move";
  coordinate: AnthropicComputerUseCoordinate;
};

export type AnthropicComputerUseClickAction = {
  action:
    | "left_click"
    | "right_click"
    | "middle_click"
    | "double_click"
    | "triple_click";
  coordinate?: AnthropicComputerUseCoordinate;
  key?: string;
};

export type AnthropicComputerUseLeftClickDragAction = {
  action: "left_click_drag";
  start_coordinate: AnthropicComputerUseCoordinate;
  coordinate: AnthropicComputerUseCoordinate;
};

export type AnthropicComputerUseTypeAction = {
  action: "type";
  text: string;
};

export type AnthropicComputerUseKeyAction = {
  action: "key";
  text: string;
};

export type AnthropicComputerUseLeftMouseAction = {
  action: "left_mouse_down" | "left_mouse_up";
};

export type AnthropicComputerUseScrollAction = {
  action: "scroll";
  scroll_direction: AnthropicComputerUseScrollDirection;
  scroll_amount: number;
  coordinate?: AnthropicComputerUseCoordinate;
  text?: string;
};

export type AnthropicComputerUseHoldKeyAction = {
  action: "hold_key";
  text: string;
  duration: number;
};

export type AnthropicComputerUseWaitAction = {
  action: "wait";
  duration: number;
};

export type AnthropicComputerUseZoomAction = {
  action: "zoom";
  region: AnthropicComputerUseRegion;
};

export type AnthropicComputerUseAction =
  | AnthropicComputerUseScreenshotAction
  | AnthropicComputerUseCursorPositionAction
  | AnthropicComputerUseMouseMoveAction
  | AnthropicComputerUseClickAction
  | AnthropicComputerUseLeftClickDragAction
  | AnthropicComputerUseTypeAction
  | AnthropicComputerUseKeyAction
  | AnthropicComputerUseLeftMouseAction
  | AnthropicComputerUseScrollAction
  | AnthropicComputerUseHoldKeyAction
  | AnthropicComputerUseWaitAction
  | AnthropicComputerUseZoomAction;

export type ComputerUseScreenshot = {
  mimeType: "image/png";
  data: string;
  width: number;
  height: number;
};

export type AnthropicComputerUseResult = {
  success: boolean;
  output?: string;
  error?: string;
  base64_image?: string;
  stdout?: string;
  stderr?: string;
};

export type ComputerUseActionResult = {
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

export interface AnthropicComputerUseInstance {
  computerUseTool(
    options?: AnthropicComputerUseToolOptions,
  ): Promise<AnthropicComputerUseToolDefinition>;
  computerUse(
    action: AnthropicComputerUseAction,
  ): Promise<AnthropicComputerUseResult>;
}

export namespace Anthropic {
  export type Coordinate = AnthropicComputerUseCoordinate;
  export type Region = AnthropicComputerUseRegion;
  export type ScrollDirection = AnthropicComputerUseScrollDirection;
  export type ToolType = AnthropicComputerUseToolType;
  export type AllowedCaller = AnthropicComputerUseAllowedCaller;
  export type CacheControlEphemeral =
    AnthropicComputerUseCacheControlEphemeral;
  export type ToolOptions = AnthropicComputerUseToolOptions;
  export type ToolDefinitionBase<TType extends ToolType> =
    AnthropicComputerUseToolDefinitionBase<TType>;
  export type ToolDefinition20241022 =
    AnthropicComputerUseToolDefinition20241022;
  export type ToolDefinition20250124 =
    AnthropicComputerUseToolDefinition20250124;
  export type ToolDefinition20251124 =
    AnthropicComputerUseToolDefinition20251124;
  export type ToolDefinition = AnthropicComputerUseToolDefinition;
  export type ScreenshotAction = AnthropicComputerUseScreenshotAction;
  export type CursorPositionAction =
    AnthropicComputerUseCursorPositionAction;
  export type MouseMoveAction = AnthropicComputerUseMouseMoveAction;
  export type ClickAction = AnthropicComputerUseClickAction;
  export type LeftClickDragAction =
    AnthropicComputerUseLeftClickDragAction;
  export type TypeAction = AnthropicComputerUseTypeAction;
  export type KeyAction = AnthropicComputerUseKeyAction;
  export type LeftMouseAction = AnthropicComputerUseLeftMouseAction;
  export type ScrollAction = AnthropicComputerUseScrollAction;
  export type HoldKeyAction = AnthropicComputerUseHoldKeyAction;
  export type WaitAction = AnthropicComputerUseWaitAction;
  export type ZoomAction = AnthropicComputerUseZoomAction;
  export type Action = AnthropicComputerUseAction;
  export type Result = AnthropicComputerUseResult;
  export type ComputerUse = AnthropicComputerUseInstance;
}

export interface VmComputerUse<
  T extends VmComputerUseInstance = VmComputerUseInstance,
> extends VmWith<T> {}

export interface VmComputerUseInstance extends VmWithInstance {
  anthropic: Anthropic.ComputerUse;
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
