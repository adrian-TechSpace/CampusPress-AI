import type { StaticImageData } from "next/image";

import campusHero from "../../assets/Chrisland University College of Law building.jpg";
import lectureRooms from "../../assets/Entrance of lecture rooms.jpg";
import newspaperReader from "../../assets/Jornalism images/dcnigeriaapr13_NSTfield_image_socialmedia.var_1586762471.jpg";
import fieldReporter from "../../assets/Jornalism images/Photo-by-Numbercfoto-via-Iwaria.jpg";
import readingExperience from "../../assets/Jornalism images/onur-kurt-reading-newspaper-unsplash.jpg";
import { categoryNames } from "@/lib/categories";

export type Interest = string;

export type Author = {
  id: string;
  name: string;
  role: string;
  bio: string;
};

export type Article = {
  slug: string;
  title: string;
  deck: string;
  category: Interest;
  interests: Interest[];
  authorId: string;
  authorName?: string;
  authorRole?: string;
  publishedAt: string;
  publishedSort?: string;
  readTime: string;
  heroImage: StaticImageData | string;
  imageAlt: string;
  imageCredit: string;
  body: string[];
};

export const interests: Interest[] = categoryNames;

export const authors: Author[] = [
  {
    id: "mara-adebayo",
    name: "Mara Adebayo",
    role: "Features editor",
    bio: "Reports on campus learning spaces, student services, and the daily systems students rely on.",
  },
  {
    id: "ife-olanipekun",
    name: "Ife Olanipekun",
    role: "News reporter",
    bio: "Covers governance, policy changes, and student representation with a focus on clear sourcing.",
  },
  {
    id: "nora-eze",
    name: "Nora Eze",
    role: "Reader editor",
    bio: "Builds explainers that make campus decisions easier to follow for first-time readers.",
  },
  {
    id: "tobi-akinwale",
    name: "Tobi Akinwale",
    role: "Photojournalist",
    bio: "Documents campus life, field reporting, and visual evidence behind published stories.",
  },
];

export const publishedArticles: Article[] = [
  {
    slug: "inside-chrisland-student-newsroom",
    title: "Inside the Student Newsroom Taking Shape at Chrisland",
    deck: "A new editorial rhythm is helping student reporters turn campus questions into reported, publishable stories.",
    category: "Campus Life",
    interests: ["Campus Life", "Academics"],
    authorId: "mara-adebayo",
    publishedAt: "July 19, 2026",
    readTime: "5 min read",
    heroImage: campusHero,
    imageAlt: "Chrisland University College of Law building in daylight.",
    imageCredit: "CampusPress photo archive",
    body: [
      "The first habit a student newsroom needs is not speed. It is attention. Editors at CampusPress AI are shaping a workflow that starts with the question students are already asking and ends with a story that makes the answer easier to trust.",
      "That means every pitch has to name its audience, its evidence, and the campus decision it helps readers understand. A cafeteria update, a timetable change, and a student union briefing all need the same basic discipline: what happened, who it affects, and what is still unknown.",
      "The newsroom is also designed to teach judgment. Student journalists can draft, revise, and ask for editorial review inside one workspace, while readers get a calmer front door into the finished work.",
      "For Chrisland readers, the result should feel practical. The best campus story is useful the first time, searchable a week later, and transparent enough that readers know why it appeared in their feed.",
    ],
  },
  {
    slug: "lecture-room-renewal-and-student-access",
    title: "What Students Notice First When Lecture Spaces Change",
    deck: "Small improvements to entrances, circulation, and seating can change how students experience a teaching day.",
    category: "Academics",
    interests: ["Academics", "Campus Life"],
    authorId: "mara-adebayo",
    publishedAt: "July 18, 2026",
    readTime: "4 min read",
    heroImage: lectureRooms,
    imageAlt: "Entrance of Chrisland University lecture rooms.",
    imageCredit: "CampusPress photo archive",
    body: [
      "Students often describe campus infrastructure through the details that shape their routine. A clearer entrance can matter as much as a new sign, especially when a building serves hundreds of students moving between lectures.",
      "The most useful reporting on facilities work stays close to those lived details. It asks who benefits, what remains unfinished, and whether the change solves the problem students raised in the first place.",
      "CampusPress AI will treat these stories as service journalism. A facilities story should not read like a notice board. It should explain the decision, show the evidence, and leave students with the next practical step.",
    ],
  },
  {
    slug: "why-campus-news-needs-context",
    title: "Why Campus News Needs More Context, Not More Noise",
    deck: "A reader-first campus publication should explain what changed and why it matters before asking anyone to react.",
    category: "Opinion",
    interests: ["Opinion", "Student Government"],
    authorId: "nora-eze",
    publishedAt: "July 17, 2026",
    readTime: "6 min read",
    heroImage: newspaperReader,
    imageAlt: "A reader holding a newspaper.",
    imageCredit: "News reading reference photo",
    body: [
      "Campus readers are asked to process a constant stream of notices, screenshots, reminders, and forwarded messages. Journalism earns attention by doing a different job: it slows the claim down long enough to test it.",
      "Context is not padding. It is the part of a story that prevents readers from mistaking a single quote for the whole decision. It explains the timeline, names the office involved, and separates what is confirmed from what is still being checked.",
      "For a student publication, this standard is also protective. It gives writers a shared discipline and gives readers a reason to return when the first version of a story is not the final version.",
      "The goal is not to sound bigger than the campus. The goal is to be useful to the campus with the same care readers expect from any serious publication.",
    ],
  },
  {
    slug: "field-notes-from-student-reporters",
    title: "Field Notes From Student Reporters Learning the Beat",
    deck: "Reporting gets stronger when writers can pair direct observation with transparent editorial review.",
    category: "Investigations",
    interests: ["Investigations", "Campus Life"],
    authorId: "tobi-akinwale",
    publishedAt: "July 16, 2026",
    readTime: "7 min read",
    heroImage: fieldReporter,
    imageAlt: "A field reporter holding a camera.",
    imageCredit: "Photo by Numbercfoto via Iwaria",
    body: [
      "The first version of a reported story is often a notebook, a recording, and a question that has not yet found its shape. Student reporters need a workflow that respects that early uncertainty without letting it become carelessness.",
      "A field note is valuable because it records what the reporter saw before memory smooths over the details. It can capture the queue outside an office, the sign that was missing, or the exact wording of a posted notice.",
      "CampusPress AI turns those notes into editorial evidence. Editors can ask what the observation proves, what it does not prove, and which source needs to be contacted before publication.",
      "That review process is not meant to slow reporting for its own sake. It is meant to make the published story stronger than the rumor it replaces.",
    ],
  },
  {
    slug: "a-quieter-way-to-read-campus-news",
    title: "A Quieter Way to Read Campus News",
    deck: "The best reader experience keeps the story in focus and lets navigation recede until it is needed.",
    category: "Campus Life",
    interests: ["Campus Life", "Opinion"],
    authorId: "nora-eze",
    publishedAt: "July 15, 2026",
    readTime: "5 min read",
    heroImage: readingExperience,
    imageAlt: "A person reading a newspaper beside a window.",
    imageCredit: "Photo by Onur Kurt on Unsplash",
    body: [
      "A good article page should feel almost invisible. The headline carries the first impression, the deck tells the reader what kind of commitment the story asks for, and the body settles into a measure that can be read without effort.",
      "That is the standard CampusPress AI is using for reader surfaces. The page can still support bookmarks, follows, comments, and recommendations, but those actions should stay secondary to the article itself.",
      "This matters most on phones, where every extra panel competes with the sentence in front of the reader. A quiet layout is not plain. It is respectful.",
    ],
  },
];

export const notifications = [
  {
    id: "note-1",
    title: "New story from Mara Adebayo",
    description:
      "Mara published a campus life story about the student newsroom taking shape at Chrisland.",
    time: "Today",
  },
  {
    id: "note-2",
    title: "Your bookmark was saved",
    description:
      "The article is now available from your bookmarks list on this device.",
    time: "Yesterday",
  },
  {
    id: "note-3",
    title: "More reporting on academics",
    description:
      "Because you follow academic coverage, the feed added a story about lecture spaces and student access.",
    time: "This week",
  },
];

export function getAuthor(authorId: string) {
  return authors.find((author) => author.id === authorId) ?? authors[0];
}

export function getArticleAuthor(article: Article) {
  if (article.authorName) {
    return {
      id: article.authorId,
      name: article.authorName,
      role: article.authorRole ?? "Student journalist",
      bio: "",
    };
  }

  return getAuthor(article.authorId);
}

export function getArticle(slug: string) {
  return publishedArticles.find((article) => article.slug === slug);
}

export function scoreArticle(article: Article, selectedInterests: Interest[]) {
  return article.interests.reduce(
    (score, interest) =>
      score + (selectedInterests.some((selectedInterest) => interestMatches(interest, selectedInterest)) ? 1 : 0),
    0,
  );
}

export function hasSelectedInterestMatch(article: Article, selectedInterests: Interest[]) {
  return scoreArticle(article, selectedInterests) > 0;
}

export function orderArticlesForInterests(articles: Article[], selectedInterests: Interest[]) {
  const activeInterests: Interest[] =
    selectedInterests.length > 0 ? selectedInterests : ["Campus Life"];

  return [...articles]
    .map((article, index) => ({
      article,
      index,
      score: scoreArticle(article, activeInterests),
      matchedInterests: article.interests.filter((interest) =>
        activeInterests.some((selectedInterest) => interestMatches(interest, selectedInterest)),
      ),
    }))
    .sort((a, b) => {
      const aHasSelectedInterestMatch = hasSelectedInterestMatch(a.article, activeInterests);
      const bHasSelectedInterestMatch = hasSelectedInterestMatch(b.article, activeInterests);

      if (aHasSelectedInterestMatch !== bHasSelectedInterestMatch) {
        return aHasSelectedInterestMatch ? -1 : 1;
      }

      return b.score - a.score || compareArticleDates(b.article, a.article) || a.index - b.index;
    });
}

export function getPersonalizedFeed(
  selectedInterests: Interest[],
  articles: Article[] = publishedArticles,
) {
  return orderArticlesForInterests(articles, selectedInterests);
}

export function whyArticleAppears(article: Article, selectedInterests: Interest[]) {
  const matchedInterests = article.interests.filter((interest) =>
    selectedInterests.some((selectedInterest) => interestMatches(interest, selectedInterest)),
  );

  if (matchedInterests.length > 0) {
    return `Why you are seeing this: it matches your interest in ${matchedInterests.join(
      " and ",
    )}.`;
  }

  if (selectedInterests.length > 0) {
    return "Why you are seeing this: it fills out your feed after stories that match your selected interests.";
  }

  return "Why you are seeing this: Campus Life is included as your starter interest until you choose more topics.";
}

export function searchArticles(query: string) {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return publishedArticles;
  }

  return publishedArticles.filter((article) => {
    const author = getAuthor(article.authorId);
    const haystack = [
      article.title,
      article.deck,
      article.category,
      article.interests.join(" "),
      author.name,
      ...article.body,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(trimmed);
  });
}

function compareArticleDates(left: Article, right: Article) {
  return dateValue(left) - dateValue(right);
}

function dateValue(article: Article) {
  const value = article.publishedSort ?? article.publishedAt;
  const time = new Date(value).getTime();

  return Number.isFinite(time) ? time : 0;
}

function interestMatches(left: Interest, right: Interest) {
  const normalizedLeft = normalizeInterest(left);
  const normalizedRight = normalizeInterest(right);

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const leftAliases = interestAliases[normalizedLeft] ?? [];
  const rightAliases = interestAliases[normalizedRight] ?? [];

  return leftAliases.includes(normalizedRight) || rightAliases.includes(normalizedLeft);
}

function normalizeInterest(value: Interest) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const interestAliases: Record<string, string[]> = {
  academics: ["research"],
  "campus life": ["campus news", "student life"],
  "campus news": ["campus life", "student life"],
  research: ["academics"],
  "student life": ["campus life", "campus news"],
};
