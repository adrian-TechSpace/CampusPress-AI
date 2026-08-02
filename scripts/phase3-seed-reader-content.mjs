import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Missing Supabase environment variables.");
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const authors = [
  {
    email: "mara.adebayo@campuspress.seed",
    fullName: "Mara Adebayo",
    username: "mara_adebayo",
    phoneNumber: "+2348000000101",
    role: "journalist",
    departmentCode: "MAS",
    entryYear: 2022,
    idNumber: "MAS/2022/101",
    bio: "Reports on campus learning spaces, student services, and the daily systems students rely on.",
  },
  {
    email: "ife.olanipekun@campuspress.seed",
    fullName: "Ife Olanipekun",
    username: "ife_olanipekun",
    phoneNumber: "+2348000000102",
    role: "journalist",
    departmentCode: "POL",
    entryYear: 2022,
    idNumber: "POL/2022/102",
    bio: "Covers governance, policy changes, and student representation with a focus on clear sourcing.",
  },
  {
    email: "nora.eze@campuspress.seed",
    fullName: "Nora Eze",
    username: "nora_eze",
    phoneNumber: "+2348000000103",
    role: "journalist",
    departmentCode: "MAS",
    entryYear: 2022,
    idNumber: "MAS/2022/103",
    bio: "Builds explainers that make campus decisions easier to follow for first-time readers.",
  },
  {
    email: "tobi.akinwale@campuspress.seed",
    fullName: "Tobi Akinwale",
    username: "tobi_akinwale",
    phoneNumber: "+2348000000104",
    role: "journalist",
    departmentCode: "MAS",
    entryYear: 2022,
    idNumber: "MAS/2022/104",
    bio: "Documents campus life, field reporting, and visual evidence behind published stories.",
  },
];

const categories = [
  { name: "Campus News", slug: "campus-news", description: "Official stories, notices, and events from campus life." },
  { name: "Campus Life", slug: "campus-life", description: "Student routines, campus services, clubs, and daily life." },
  { name: "Academics", slug: "academics", description: "Classroom, department, assessment, and study coverage." },
  { name: "Investigations", slug: "investigations", description: "Reported accountability stories with clear evidence." },
  { name: "Opinion", slug: "opinion", description: "Student and lecturer commentary with clear attribution." },
  { name: "Student Government", slug: "student-government", description: "Student representation, elections, and campus governance." },
  { name: "Features", slug: "features", description: "Long-form reporting, interviews, and profiles." },
  { name: "Research", slug: "research", description: "Academic work, innovation, and department updates." },
  { name: "Sports", slug: "sports", description: "Chrisland sports coverage and results." },
];

const articles = [
  {
    slug: "inside-chrisland-student-newsroom",
    title: "Inside the Student Newsroom Taking Shape at Chrisland",
    excerpt:
      "A new editorial rhythm is helping student reporters turn campus questions into reported, publishable stories.",
    categorySlug: "campus-life",
    authorEmail: "mara.adebayo@campuspress.seed",
    plainText:
      "The first habit a student newsroom needs is not speed. It is attention. Editors at CampusPress AI are shaping a workflow that starts with the question students are already asking and ends with a story that makes the answer easier to trust.",
  },
  {
    slug: "lecture-room-renewal-and-student-access",
    title: "What Students Notice First When Lecture Spaces Change",
    excerpt:
      "Small improvements to entrances, circulation, and seating can change how students experience a teaching day.",
    categorySlug: "academics",
    authorEmail: "mara.adebayo@campuspress.seed",
    plainText:
      "Students often describe campus infrastructure through the details that shape their routine. A clearer entrance can matter as much as a new sign.",
  },
  {
    slug: "why-campus-news-needs-context",
    title: "Why Campus News Needs More Context, Not More Noise",
    excerpt:
      "A reader-first campus publication should explain what changed and why it matters before asking anyone to react.",
    categorySlug: "opinion",
    authorEmail: "nora.eze@campuspress.seed",
    plainText:
      "Campus readers are asked to process a constant stream of notices, screenshots, reminders, and forwarded messages. Journalism earns attention by doing a different job.",
  },
  {
    slug: "field-notes-from-student-reporters",
    title: "Field Notes From Student Reporters Learning the Beat",
    excerpt:
      "Reporting gets stronger when writers can pair direct observation with transparent editorial review.",
    categorySlug: "investigations",
    authorEmail: "tobi.akinwale@campuspress.seed",
    plainText:
      "The first version of a reported story is often a notebook, a recording, and a question that has not yet found its shape.",
  },
  {
    slug: "a-quieter-way-to-read-campus-news",
    title: "A Quieter Way to Read Campus News",
    excerpt:
      "The best reader experience keeps the story in focus and lets navigation recede until it is needed.",
    categorySlug: "campus-life",
    authorEmail: "nora.eze@campuspress.seed",
    plainText:
      "A good article page should feel almost invisible. The headline carries the first impression, the deck tells the reader what kind of commitment the story asks for.",
  },
];

const institution = await getInstitution();
const authorIds = new Map();

for (const author of authors) {
  const userId = await ensureAuthorUser(author.email, author.fullName);
  authorIds.set(author.email, userId);

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      institution_id: institution.id,
      email: author.email,
      full_name: author.fullName,
      username: author.username,
      phone_number: author.phoneNumber,
      role: author.role,
      department_code: author.departmentCode,
      entry_year: author.entryYear,
      matric_or_staff_id: author.idNumber,
      bio: author.bio,
      preferences: { seeded_author: true },
      verified: true,
      verified_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Could not upsert author profile ${author.email}: ${error.message}`);
  }
}

const categoryIds = new Map();
for (const category of categories) {
  const { data, error } = await supabase
    .from("categories")
    .upsert(category, { onConflict: "slug" })
    .select("id, slug")
    .single();

  if (error || !data) {
    throw new Error(`Could not upsert category ${category.slug}: ${error?.message}`);
  }

  categoryIds.set(data.slug, data.id);
}

for (const article of articles) {
  const { error } = await supabase.from("articles").upsert(
    {
      author_id: authorIds.get(article.authorEmail),
      category_id: categoryIds.get(article.categorySlug),
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      plain_text: article.plainText,
      content: { paragraphs: [article.plainText] },
      status: "published",
      published_at: new Date().toISOString(),
    },
    { onConflict: "slug" },
  );

  if (error) {
    throw new Error(`Could not upsert article ${article.slug}: ${error.message}`);
  }
}

console.log(
  JSON.stringify({
    seededAuthors: authors.length,
    seededArticles: articles.length,
  }),
);

async function getInstitution() {
  const { data, error } = await supabase
    .from("institutions")
    .select("id")
    .eq("slug", "chrisland-university")
    .single();

  if (error || !data) {
    throw new Error(`Could not find Chrisland institution: ${error?.message}`);
  }

  return data;
}

async function ensureAuthorUser(email, fullName) {
  const existing = await findUserByEmail(email);

  if (existing) {
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: `CampusPressSeed${Date.now()}!`,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      seeded_author: true,
    },
  });

  if (error || !data.user) {
    throw new Error(`Could not create seed author ${email}: ${error?.message}`);
  }

  return data.user.id;
}

async function findUserByEmail(email) {
  let page = 1;

  while (page < 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find((item) => item.email?.toLowerCase() === email);

    if (user) {
      return user;
    }

    if (data.users.length < 100) {
      return null;
    }

    page += 1;
  }

  return null;
}
