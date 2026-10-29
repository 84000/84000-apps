import { redirect } from 'next/navigation';

/** The index lives at /translation, beside the reader route it links into. */
const Page = () => redirect('/translation');

export default Page;
