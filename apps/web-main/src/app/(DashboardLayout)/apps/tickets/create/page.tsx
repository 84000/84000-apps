import type { Metadata } from 'next';
import CreateTicketForm from '../../../../components/apps/tickets/CreateTicketForm';
import BreadcrumbComp from '../../../layout/shared/breadcrumb/BreadcrumbComp';
import { TicketProvider } from '../../../../context/TicketContext/index';

export const metadata: Metadata = {
  title: 'Ticket App',
};

const BCrumb = [
  {
    to: '/',
    title: 'Home',
  },
  {
    title: 'Tickets',
  },
];
const CreateTickets = () => {
  return (
    <>
      <BreadcrumbComp title="Tickets App" items={BCrumb} />
      <TicketProvider>
        <CreateTicketForm />
      </TicketProvider>
    </>
  );
};

export default CreateTickets;
