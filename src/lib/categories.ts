export const canonicalCategories = [
  {
    name: "Campus News",
    slug: "campus-news",
    description: "Official stories, notices, and events from campus life.",
  },
  {
    name: "Campus Life",
    slug: "campus-life",
    description: "Student routines, campus services, clubs, and daily life.",
  },
  {
    name: "Academics",
    slug: "academics",
    description: "Classroom, department, assessment, and study coverage.",
  },
  {
    name: "Investigations",
    slug: "investigations",
    description: "Reported accountability stories with clear evidence.",
  },
  {
    name: "Opinion",
    slug: "opinion",
    description: "Student and lecturer commentary with clear attribution.",
  },
  {
    name: "Student Government",
    slug: "student-government",
    description: "Student representation, elections, and campus governance.",
  },
  {
    name: "Features",
    slug: "features",
    description: "Long-form reporting, interviews, and profiles.",
  },
  {
    name: "Research",
    slug: "research",
    description: "Academic work, innovation, and department updates.",
  },
  {
    name: "Sports",
    slug: "sports",
    description: "Chrisland sports coverage and results.",
  },
] as const;

export type CanonicalCategory = (typeof canonicalCategories)[number];
export type CanonicalCategoryName = CanonicalCategory["name"];

export const categoryNames = canonicalCategories.map((category) => category.name);

export const categorySuggestionSchema = {
  type: "json_schema",
  name: "campuspress_category_suggestion",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      category: {
        type: "string",
        enum: categoryNames,
      },
      reason: {
        type: "string",
      },
    },
    required: ["category", "reason"],
  },
} as const;

export function categoryByName(name: string) {
  return canonicalCategories.find(
    (category) => category.name.toLowerCase() === name.trim().toLowerCase(),
  ) ?? null;
}

export function categoryBySlug(slug: string) {
  return canonicalCategories.find((category) => category.slug === slug.trim().toLowerCase()) ?? null;
}

export function categoryNamesForPrompt() {
  return categoryNames.join(", ");
}
