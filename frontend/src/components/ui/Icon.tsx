import {
  ArrowLeft,
  ArrowUp,
  Bell,
  BookOpen,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  CloudUpload,
  CircleCheck,
  Download,
  Ellipsis,
  Eye,
  FileText,
  Folder,
  HelpCircle,
  History,
  Home,
  LayoutTemplate,
  ListChecks,
  MessageSquare,
  Moon,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sun,
  Target,
  TriangleAlert,
  Trash2,
  Upload,
  Plus,
  Workflow,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

import { iconSize, type IconSize } from "../../styles/tokens";

const ICON_STROKE_WIDTH = 1.5;

const icons = {
  alertTriangle: TriangleAlert,
  arrowLeft: ArrowLeft,
  arrowUp: ArrowUp,
  bell: Bell,
  bookOpen: BookOpen,
  bug: Bug,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clipboardCheck: ClipboardCheck,
  download: Download,
  eye: Eye,
  fileReview: FileText,
  folder: Folder,
  help: HelpCircle,
  history: History,
  home: Home,
  messageSquare: MessageSquare,
  moon: Moon,
  moreHorizontal: Ellipsis,
  plus: Plus,
  refresh: RefreshCw,
  settings: Settings,
  shieldCheck: ShieldCheck,
  spark: CircleCheck,
  sun: Sun,
  target: Target,
  template: LayoutTemplate,
  trash: Trash2,
  upload: Upload,
  uploadCloud: CloudUpload,
  version: ListChecks,
  workflow: Workflow,
  x: X,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export type IconProps = Omit<LucideProps, "size" | "strokeWidth"> & {
  decorative?: boolean;
  name?: IconName;
  size?: IconSize;
};

function resolveIconSize(size: IconSize = "md") {
  return iconSize[size];
}

export function Icon({ className, decorative = true, name = "fileReview", size = "md", ...props }: IconProps) {
  const LucideIcon = icons[name];
  const ariaHidden = decorative ? true : props["aria-hidden"];

  return (
    <LucideIcon
      {...props}
      aria-hidden={ariaHidden}
      absoluteStrokeWidth
      className={`ui-icon ui-icon--${size} ${className ?? ""}`.trim()}
      focusable="false"
      size={resolveIconSize(size)}
      strokeWidth={ICON_STROKE_WIDTH}
    />
  );
}

type NamedIconProps = Omit<IconProps, "name">;

export function AlertTriangleIcon(props: NamedIconProps) {
  return <Icon name="alertTriangle" {...props} />;
}

export function ArrowLeftIcon(props: NamedIconProps) {
  return <Icon name="arrowLeft" {...props} />;
}

export function ArrowUpIcon(props: NamedIconProps) {
  return <Icon name="arrowUp" {...props} />;
}

export function BellIcon(props: NamedIconProps) {
  return <Icon name="bell" {...props} />;
}

export function BookOpenIcon(props: NamedIconProps) {
  return <Icon name="bookOpen" {...props} />;
}

export function BugIcon(props: NamedIconProps) {
  return <Icon name="bug" {...props} />;
}

export function ChevronDownIcon(props: NamedIconProps) {
  return <Icon name="chevronDown" {...props} />;
}

export function ChevronLeftIcon(props: NamedIconProps) {
  return <Icon name="chevronLeft" {...props} />;
}

export function ChevronRightIcon(props: NamedIconProps) {
  return <Icon name="chevronRight" {...props} />;
}

export function ClipboardCheckIcon(props: NamedIconProps) {
  return <Icon name="clipboardCheck" {...props} />;
}

export function DownloadIcon(props: NamedIconProps) {
  return <Icon name="download" {...props} />;
}

export function EyeIcon(props: NamedIconProps) {
  return <Icon name="eye" {...props} />;
}

export function FileReviewIcon(props: NamedIconProps) {
  return <Icon name="fileReview" {...props} />;
}

export function FolderIcon(props: NamedIconProps) {
  return <Icon name="folder" {...props} />;
}

export function HelpIcon(props: NamedIconProps) {
  return <Icon name="help" {...props} />;
}

export function HistoryIcon(props: NamedIconProps) {
  return <Icon name="history" {...props} />;
}

export function MessageSquareIcon(props: NamedIconProps) {
  return <Icon name="messageSquare" {...props} />;
}

export function MoonIcon(props: NamedIconProps) {
  return <Icon name="moon" {...props} />;
}

export function HomeIcon(props: NamedIconProps) {
  return <Icon name="home" {...props} />;
}

export function MoreHorizontalIcon(props: NamedIconProps) {
  return <Icon name="moreHorizontal" {...props} />;
}

export function PlusIcon(props: NamedIconProps) {
  return <Icon name="plus" {...props} />;
}

export function RefreshIcon(props: NamedIconProps) {
  return <Icon name="refresh" {...props} />;
}

export function SettingsIcon(props: NamedIconProps) {
  return <Icon name="settings" {...props} />;
}

export function ShieldCheckIcon(props: NamedIconProps) {
  return <Icon name="shieldCheck" {...props} />;
}

export function SparkIcon(props: NamedIconProps) {
  return <Icon name="spark" {...props} />;
}

export function SunIcon(props: NamedIconProps) {
  return <Icon name="sun" {...props} />;
}

export function TargetIcon(props: NamedIconProps) {
  return <Icon name="target" {...props} />;
}

export function TemplateIcon(props: NamedIconProps) {
  return <Icon name="template" {...props} />;
}

export function TrashIcon(props: NamedIconProps) {
  return <Icon name="trash" {...props} />;
}

export function UploadCloudIcon(props: NamedIconProps) {
  return <Icon name="uploadCloud" {...props} />;
}

export function UploadIcon(props: NamedIconProps) {
  return <Icon name="upload" {...props} />;
}

export function VersionIcon(props: NamedIconProps) {
  return <Icon name="version" {...props} />;
}

export function WorkflowIcon(props: NamedIconProps) {
  return <Icon name="workflow" {...props} />;
}

export function XIcon(props: NamedIconProps) {
  return <Icon name="x" {...props} />;
}
