/** Ícones do sistema usando Lucide (mesmas exportações, mesmo contrato visual) */
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleHelp,
  Columns2,
  Contrast,
  Expand,
  Eye,
  EyeOff,
  FileText,
  Home,
  Image,
  Info,
  Key,
  LocateFixed,
  Lock,
  LogIn,
  LogOut,
  Map,
  Menu,
  MessageCircle,
  Moon,
  Palette,
  Pencil,
  Plus,
  Printer,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Rows2,
  Save,
  Scan,
  Search,
  Send,
  Shrink,
  Smile,
  Star,
  Sun,
  Tag,
  Trash2,
  Undo2,
  Unlink,
  User,
  Users,
  X,
} from 'lucide-react';

type IconProps = { className?: string };

function icon(Icon: LucideIcon) {
  return function AppIcon({ className = 'h-5 w-5' }: IconProps) {
    return <Icon className={className} strokeWidth={1.75} aria-hidden="true" />;
  };
}

export const IconLock = icon(Lock);
export const IconPencil = icon(Pencil);
export const IconCheck = icon(Check);
export const IconUndo = icon(Undo2);
export const IconRedo = icon(Redo2);
export const IconTrash = icon(Trash2);
export const IconTag = icon(Tag);
export const IconPlus = icon(Plus);
export const IconSave = icon(Save);
export const IconEye = icon(Eye);
export const IconEyeOff = icon(EyeOff);
export const IconRefresh = icon(RefreshCw);
export const IconKey = icon(Key);
export const IconStar = icon(Star);
export const IconUnlink = icon(Unlink);
export const IconSearch = icon(Search);
export const IconSend = icon(Send);
export const IconSmile = icon(Smile);
export const IconLocate = icon(LocateFixed);
export const IconArrowLeft = icon(ArrowLeft);
export const IconArrowUp = icon(ArrowUp);
export const IconCheckCircle = icon(CircleCheck);
export const IconX = icon(X);
export const IconInfo = icon(Info);
export const IconHelp = icon(CircleHelp);
export const IconNote = icon(MessageCircle);
export const IconSun = icon(Sun);
export const IconMoon = icon(Moon);
export const IconUsers = icon(Users);
export const IconUser = icon(User);
export const IconMap = icon(Map);
export const IconImage = icon(Image);
export const IconRotateLeft = icon(RotateCcw);
export const IconRotateRight = icon(RotateCw);
export const IconLogIn = icon(LogIn);
export const IconLogOut = icon(LogOut);
export const IconHome = icon(Home);
export const IconExpand = icon(Expand);
export const IconCompress = icon(Shrink);
export const IconFocusAreas = icon(Scan);
export const IconChevronDown = icon(ChevronDown);
export const IconChevronRight = icon(ChevronRight);
export const IconMenu = icon(Menu);
export const IconWarning = icon(CircleAlert);
export const IconRows = icon(Rows2);
export const IconColumns = icon(Columns2);
export const IconPalette = icon(Palette);
export const IconContrast = icon(Contrast);
export const IconFileText = icon(FileText);
export const IconPrinter = icon(Printer);
