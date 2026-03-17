import Navbar from "./Navbar";
import Footer from "./Footer";

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0b0e]">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
