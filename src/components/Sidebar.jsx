import Navbar from "./Navbar";

/**
 * Sidebar component wrapper.
 * The fixed left sidebar has been replaced with the floating horizontal pill Navbar.
 * This wrapper ensures backward compatibility for any existing references.
 */
export default function Sidebar() {
  return <Navbar />;
}
