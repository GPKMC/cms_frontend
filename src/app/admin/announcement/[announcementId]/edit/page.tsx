// NO "use client" here — this is a server component
import AnnouncementEditPage from "./AnnouncementEditPage";

type Params = { announcementId: string };

export default async function Page({
  params,
}: {
  // In Next 15, params is a Promise
  params: Promise<Params>;
}) {
  const resolved = await params;
  const id = resolved?.announcementId ?? "";
  return <AnnouncementEditPage id={id} />;
}
