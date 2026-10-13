import { redirect } from 'next/navigation';

/** A project URL with no tab opens its Overview (decision D4). */
export default async function ProjectIndex({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/projects/${projectId}/overview`);
}
