import type { LetterTemplate } from "./types/postcard";
import type { AppLocale } from "./i18n";

export const letterTemplates: LetterTemplate[] = [
  {
    id: "birthday",
    label: "生日祝福",
    category: "明信片",
    description: "把生日祝福做成一张温暖的纪念卡。",
    data: {
      type: "postcard",
      title: "Happy Birthday",
      caption: "愿你每一天都热烈",
      backCaption: "愿你的每一秒都被认真珍惜，今天和往后都要幸福得像糖一样甜。",
      from: "来自：我",
      to: "致：最爱的人",
      bgColor: "#f8efe3",
      textColor: "#493a2d",
      borderColor: "#d6b08d",
      stampText: "✦",
      message: "亲爱的朋友，\n\n愿你今天和每一天都充满惊喜与温暖。\n\n谢谢你一直陪伴我，愿你生日快乐，永远被爱与珍惜。",
    },
  },
  {
    id: "festival",
    label: "节日问候",
    category: "明信片",
    description: "用明亮的配色送出一份节日问候。",
    data: {
      type: "postcard",
      title: "新年快乐",
      caption: "愿新的一年更好",
      backCaption: "新的一年，愿你愿望都落地，心愿都实现，平安喜乐，万事顺遂。",
      from: "来自：我",
      to: "致：亲爱的你",
      bgColor: "#f3f5ed",
      textColor: "#36413a",
      borderColor: "#a7b39a",
      stampText: "✉",
      message: "亲爱的朋友，\n\n新的一年到来，愿你常有好心情，常有好消息，愿你新年愿望都能实现。\n\n陪伴与祝福，都是我最真诚的心意。",
    },
  },
  {
    id: "gratitude",
    label: "感谢信",
    category: "明信片",
    description: "简洁而真诚地表达感谢。",
    data: {
      type: "postcard",
      title: "Thank You",
      caption: "谢谢你一直在",
      backCaption: "感谢你在我人生的每段时光里，都认真地陪伴着我。你让这一路温暖而可贵。",
      from: "来自：我",
      to: "致：你",
      bgColor: "#f4f0f7",
      textColor: "#3e3548",
      borderColor: "#c8bdd8",
      stampText: "♥",
      message: "亲爱的朋友，\n\n这一路走来，有你真好。\n\n谢谢你给我的陪伴、鼓励与理解，我一直记在心里。",
    },
  },
  {
    id: "aged-letter",
    label: "复古手札",
    category: "信封",
    description: "暖棕色旧纸、邮戳与手写信纸的年代感。",
    data: {
      type: "envelope",
      title: "一封旧日来信",
      message: "亲爱的朋友，\n\n提笔时窗外正落着细雨，想起那些一起走过的日子，仍觉得温暖。\n\n愿这封信替我把问候送到你身边。",
      from: "来自：旧友",
      to: "致：亲爱的你",
      stampText: "✦",
      note: "复古手札模板",
    },
  },
  {
    id: "travel-letter",
    label: "远方来信",
    category: "信封",
    description: "像旅途中寄来的信，带一点褪色邮票的浪漫。",
    data: {
      type: "envelope",
      title: "来自远方",
      message: "你好，\n\n此刻我在很远的地方，天气晴朗，风里有陌生城市的气味。\n\n等我回来，再把沿途的故事慢慢讲给你听。",
      from: "来自：旅人",
      to: "致：家人",
      stampText: "邮",
      note: "远方来信模板",
    },
  },
  {
    id: "quiet-stationery",
    label: "静笺",
    category: "信纸",
    description: "带有细腻纸纹与横线的单面信纸，适合写一封完整的长信。",
    data: {
      type: "letter",
      title: "写给你",
      message: "亲爱的你，\n\n有些话适合慢慢写下来。愿这张信纸替我收好那些来不及当面说出的惦念。\n\n愿你一切都好，也愿我们很快再见。",
      bgColor: "#f2ead8",
      textColor: "#493f32",
      borderStyle: "solid",
      borderColor: "#c9b797",
      messageFont: "Georgia",
      titleFont: "Georgia",
      note: "静笺信纸模板",
    },
  },
  {
    id: "tone-warm",
    label: "温柔",
    category: "文案风格",
    description: "轻柔亲切，适合写给重要的人。",
    data: {
      type: "postcard",
      title: "给你",
      message: "亲爱的朋友，\n\n愿你每一天都被温柔对待，愿你心里有光，前路也有人陪。\n\n愿这份祝福像春风一样，轻轻落在你身上。",
      caption: "愿你一直被爱着",
      backCaption: "亲爱的朋友，\n\n愿你每一天都被温柔对待，愿你心里有光，前路也有人陪。\n\n愿这份祝福像春风一样，轻轻落在你身上。",
    },
  },
  {
    id: "tone-business",
    label: "商务",
    category: "文案风格",
    description: "稳重得体，适用于工作往来。",
    data: {
      type: "postcard",
      title: "诚挚问候",
      message: "尊敬的伙伴，\n\n值此机会，谨向您表达诚挚的感谢与美好祝愿。\n\n愿我们携手前行，合作顺利，收获共赢。",
      caption: "合作顺利",
      backCaption: "尊敬的伙伴，\n\n值此机会，谨向您表达诚挚的感谢与美好祝愿。\n\n愿我们携手前行，合作顺利，收获共赢。",
    },
  },
];

const englishTemplates: Record<string, Pick<LetterTemplate, "label" | "description"> & {
  data: Partial<LetterTemplate["data"]>;
}> = {
  birthday: {
    label: "Birthday wishes",
    description: "Turn birthday wishes into a warm keepsake postcard.",
    data: {
      title: "Happy Birthday",
      caption: "Make every day sparkle",
      backCaption: "May every moment be treasured, today and always. Wishing you a life as sweet as can be.",
      from: "From: Me",
      to: "To: Someone special",
      message: "Dear friend,\n\nWishing you a day and a year filled with surprises and warmth.\n\nThank you for being by my side. Happy birthday—you are always loved and cherished.",
    },
  },
  festival: {
    label: "Season's greetings",
    description: "Send a bright greeting for the season.",
    data: {
      title: "Happy New Year",
      caption: "May the year ahead be brighter",
      backCaption: "May the new year bring your hopes to life, your wishes come true, and peace and joy to every day.",
      from: "From: Me",
      to: "To: Dear you",
      message: "Dear friend,\n\nA new year is here. May you find good cheer and good news, and may your wishes come true.\n\nMy companionship and best wishes are sent with all my heart.",
    },
  },
  gratitude: {
    label: "A thank-you note",
    description: "Express your gratitude simply and sincerely.",
    data: {
      title: "Thank You",
      caption: "Thank you for being here",
      backCaption: "Thank you for being there for me through every season of life. You have made this journey warmer and more meaningful.",
      from: "From: Me",
      to: "To: You",
      message: "Dear friend,\n\nI'm so glad we made it this far together.\n\nThank you for your company, encouragement, and understanding. I will always remember it.",
    },
  },
  "aged-letter": {
    label: "A vintage letter",
    description: "Warm sepia paper, a postmark, and the feel of handwritten correspondence.",
    data: {
      title: "A letter from long ago",
      message: "Dear friend,\n\nAs I write, rain is falling outside. I think of the days we spent together, and they still warm my heart.\n\nMay this letter carry my greetings to you.",
      from: "From: An old friend",
      to: "To: Dear you",
      note: "Vintage letter template",
    },
  },
  "travel-letter": {
    label: "A letter from afar",
    description: "A romantic note from a journey, with a softly faded stamp.",
    data: {
      title: "From afar",
      message: "Hello,\n\nI'm somewhere far away. The sky is clear, and the wind carries the scent of an unfamiliar city.\n\nWhen I return, I'll tell you all the stories from the road.",
      from: "From: A traveler",
      to: "To: Family",
      stampText: "POST",
      note: "Letter from afar template",
    },
  },
  "quiet-stationery": {
    label: "Quiet stationery",
    description: "Textured, ruled stationery for a thoughtful, longer letter.",
    data: {
      title: "A letter for you",
      message: "Dear you,\n\nSome things are best written down, slowly. May this page keep the thoughts I didn't get to share in person.\n\nI hope all is well, and that we meet again soon.",
      note: "Quiet stationery template",
    },
  },
  "tone-warm": {
    label: "Warm",
    description: "Gentle and affectionate, for someone important.",
    data: {
      title: "For you",
      message: "Dear friend,\n\nMay every day treat you kindly. May there be light in your heart and someone by your side.\n\nMay this wish land softly, like a spring breeze.",
      caption: "Always surrounded by love",
      backCaption: "Dear friend,\n\nMay every day treat you kindly. May there be light in your heart and someone by your side.\n\nMay this wish land softly, like a spring breeze.",
    },
  },
  "tone-business": {
    label: "Business",
    description: "Professional and thoughtful, for work correspondence.",
    data: {
      title: "Warm regards",
      message: "Dear colleague,\n\nI would like to express my sincere thanks and best wishes.\n\nMay we continue to move forward together and enjoy a successful partnership.",
      caption: "To a successful partnership",
      backCaption: "Dear colleague,\n\nI would like to express my sincere thanks and best wishes.\n\nMay we continue to move forward together and enjoy a successful partnership.",
    },
  },
};

export function localizeTemplate(template: LetterTemplate, language: AppLocale): LetterTemplate {
  const translation = language === "en" ? englishTemplates[template.id] : undefined;
  return translation
    ? {
        ...template,
        label: translation.label,
        description: translation.description,
        data: { ...template.data, ...translation.data },
      }
    : template;
}
