export interface PostcardData {
  id: string;
  type: "envelope" | "postcard" | "letter";
  title: string;
  message: string;
  messageHtml?: string;
  caption: string;
  backCaption: string;
  backCaptionHtml?: string;
  note: string;
  from: string;
  to: string;
  bgColor: string;
  textColor: string;
  fontSize: number;
  borderStyle: "solid" | "dashed" | "double" | "dotted";
  borderColor: string;
  stampText: string;
  stampImage: string;
  cardImage: string;
  stickers?: LetterSticker[];
  titleFont: string;
  messageFont: string;
  captionFont: string;
  backCaptionFont: string;
  fromFont: string;
  toFont: string;
  stampFont: string;
  createdAt: string;
}

export interface LetterSticker {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  aspectRatio: number;
  rotation: number;
}

export interface LetterTemplate {
  id: string;
  label: string;
  category: "明信片" | "信封" | "信纸" | "文案风格";
  description: string;
  data: Partial<Omit<PostcardData, "id" | "createdAt">>;
}

export interface AppSettings {
  uiFont: string;
  uiFontSize: number;
  exportDirectory: string;
  exportColorMode: "light" | "dark" | "system";
}
