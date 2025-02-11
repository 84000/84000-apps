'use client';
import { CustomizerContext } from '../../context/CustomizerContext';

import { Card } from 'flowbite-react';
import React, { useContext } from 'react';

interface MyAppProps {
  children: React.ReactNode;
  className?: string;
}
const OutlineCard: React.FC<MyAppProps> = ({ children, className }) => {
  const { isCardShadow, isBorderRadius } = useContext(CustomizerContext);
  return (
    <Card
      className={`card ${className} ${
        isCardShadow ? ' border border-ld' : ' border border-ld'
      } `}
      style={{
        borderRadius: `${isBorderRadius}px`,
      }}
    >
      {children}
    </Card>
  );
};

export default OutlineCard;
