import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-dvh bg-background px-6 py-12 text-foreground md:px-12 lg:px-24">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        <header className="flex flex-col gap-8 border-b pb-8 md:flex-row md:items-start md:justify-between">
          <div className="flex max-w-3xl flex-col gap-6">
            <Badge variant="verified">Chrisland University</Badge>
            <div className="flex flex-col gap-4">
              <h1 className="font-serif text-5xl font-semibold tracking-normal text-foreground md:text-6xl">
                CampusPress AI
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Foundation preview for the student journalism platform. The
                schema, RLS guardrails, theme tokens, and shared components are
                now the base for every later phase.
              </p>
            </div>
          </div>
          <ThemeToggle />
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Schema</CardTitle>
              <CardDescription>
                Twenty one tables, roster verification, audit trail, and AI job
                logging.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="tabular-nums text-3xl font-semibold">21</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Access</CardTitle>
              <CardDescription>
                RLS enabled on every table with owner, editor, and admin
                boundaries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="tabular-nums text-3xl font-semibold">100%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Design</CardTitle>
              <CardDescription>
                Chrisland purple, reserved gold, Outfit, and Cormorant Garamond.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="tabular-nums text-3xl font-semibold">AA</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
