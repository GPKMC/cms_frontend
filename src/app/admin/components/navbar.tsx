import Image from "next/image";

export default function Navbar() {
  return (
    <div className="fixed top-0 left-0 w-full z-50 flex items-center py-4 px-2 bg-[#2E3094] gap-2">
      <Image 
        src="/images/gpkoiralalogo.svg" 
        width={60} 
        height={60} 
        alt="logo" 
      />
      <h2 className="text-xl font-bold text-white">Admin Panel</h2>
    </div>
  );
}
