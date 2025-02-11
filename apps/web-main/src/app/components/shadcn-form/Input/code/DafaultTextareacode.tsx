import React from 'react';
import CodeModal from '../../../shadcn-ui/CodeModal';

const DafaultTextareacode = () => {
  return (
    <>
      <CodeModal>
        {`
import { Textarea } from "../../shadcn-ui/Default-Ui/textarea";

 <Textarea placeholder="Type your message here." />
                `}
      </CodeModal>
    </>
  );
};

export default DafaultTextareacode;
