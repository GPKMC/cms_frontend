import AnnouncementAdminList from "./announcementlist";

export default function AnnouncementPage() {
  function showNotification() {
    alert('There goes notification');
  }

  return (
    <div>
      <AnnouncementAdminList/>
      
    </div>
  );
}