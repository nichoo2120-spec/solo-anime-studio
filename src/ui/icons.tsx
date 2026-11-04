import type {ComponentType} from 'react';
import {StudioBrushIcon} from './StudioBrushIcon';
import {StudioEraserIcon,StudioLassoIcon,StudioMoveIcon,StudioFillIcon,StudioHandIcon,StudioZoomIcon,StudioRotateCanvasIcon,StudioEyedropperIcon,StudioVectorIcon,StudioStrokeSelectIcon,StudioRectangleIcon} from './StudioToolIcons';
import type {Tool} from '../core/model';
type ToolIcon=ComponentType<{size?:number|string;className?:string}>;
export type ToolGroup = 'draw' | 'select' | 'transform' | 'view' | 'color';
export type ToolEntry = {id:Tool;name:string;icon:ToolIcon;key:string;group:ToolGroup};
export const toolRegistry: ToolEntry[] = [
  {id:'brush',name:'Brush',icon:StudioBrushIcon,key:'B',group:'draw'},
  {id:'vector',name:'Vector Pen',icon:StudioVectorIcon,key:'N',group:'draw'},
  {id:'eraser',name:'Eraser',icon:StudioEraserIcon,key:'E',group:'draw'},
  {id:'fill',name:'Fill',icon:StudioFillIcon,key:'G',group:'draw'},
  {id:'stroke-select',name:'Stroke Select',icon:StudioStrokeSelectIcon,key:'S',group:'select'},
  {id:'lasso',name:'Lasso selection',icon:StudioLassoIcon,key:'L',group:'select'},
  {id:'rectangle',name:'Rectangle Selection',icon:StudioRectangleIcon,key:'M',group:'select'},
  {id:'transform',name:'Transform',icon:StudioMoveIcon,key:'V',group:'transform'},
  {id:'hand',name:'Hand / Pan',icon:StudioHandIcon,key:'H',group:'view'},
  {id:'zoom',name:'Zoom tool',icon:StudioZoomIcon,key:'Z',group:'view'},
  {id:'rotate',name:'Rotate Canvas tool',icon:StudioRotateCanvasIcon,key:'R',group:'view'},
  {id:'eyedropper',name:'Eyedropper',icon:StudioEyedropperIcon,key:'I',group:'color'},
];
export const allTools = toolRegistry;
export const tools = toolRegistry.filter(t => t.group === 'draw');
export const selectionTools = toolRegistry.filter(t => t.group === 'select');
export const navigationTools = toolRegistry.filter(t => t.group === 'view' || t.group === 'color');
