'use client';

import { Imprint } from '@data-access';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@design-system';
import { CircleAlertIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const RESTRICTION_COOKIE_NAME = 'eft-restriction-warning-ignored';

export const getCookie = (name: string): string | undefined => {
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];

  return cookieValue;
};

export const setCookie = (name: string, value: string, days = 365) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value}; ${expires}; path=/`;
};

export const useRestrictionWarning = ({ imprint }: { imprint?: Imprint }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldIgnore, setShouldIgnore] = useState(true);
  const [toIgnore, setToIgnore] = useState<string[]>([]);

  useEffect(() => {
    const toIgnoreStr = getCookie(RESTRICTION_COOKIE_NAME) || '[]';
    const toIgnore = JSON.parse(toIgnoreStr) || [];
    setToIgnore(toIgnore);
  }, []);

  useEffect(() => {
    if (!imprint?.uuid) {
      return;
    }

    setShouldIgnore(toIgnore.includes(imprint.uuid));
  }, [toIgnore, imprint]);

  useEffect(() => {
    if (!shouldIgnore && imprint?.restriction) {
      setIsOpen(true);
    }
  }, [shouldIgnore, imprint]);

  const ignore = () => {
    if (!imprint?.uuid) {
      return;
    }

    const newToIgnore = [...toIgnore, imprint.uuid];
    setToIgnore(newToIgnore);
    setCookie(RESTRICTION_COOKIE_NAME, JSON.stringify(newToIgnore));
  };

  return {
    isOpen,
    setIsOpen,
    ignore,
  };
};

export const RestrictionWarning = ({ imprint }: { imprint?: Imprint }) => {
  const { isOpen, setIsOpen, ignore } = useRestrictionWarning({ imprint });
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="max-w-readable w-full font-serif"
        showCloseButton={false}
      >
        <DialogHeader>
          <div className="flex justify-between pb-4 text-destructive">
            <CircleAlertIcon className="my-auto" />
            <DialogTitle className="my-auto text-2xl">
              Tantra Text Warning
            </DialogTitle>
            <DialogClose className="my-auto">
              <XIcon />
            </DialogClose>
          </div>
        </DialogHeader>
        <p>
          Readers are reminded that according to Vajrayāna Buddhist tradition
          there are restrictions and commitments concerning tantra.
        </p>
        <p>
          Practitioners who are not sure if they should read translations in
          this section are advised to consult the authorities of their lineage.
        </p>
        <p>
          The responsibility for reading these texts or sharing them with
          others—and hence the consequences—lies in the hands of readers.
        </p>
        <Accordion type="single" collapsible>
          <AccordionItem value="more-info">
            <AccordionTrigger className="text-base">
              About unrestricted access
            </AccordionTrigger>
            <AccordionContent className="space-y-2 leading-6">
              <p>
                The decision to publish tantra texts without restricted access
                has been considered carefully. First of all, it should be noted
                that all the original Tibetan texts of the Kangyur, including
                those in this Tantra section, are in the public domain. Some of
                the texts in this section (but by no means all of them) are
                nevertheless, according to some traditions, only studied with
                authorization and after suitable preliminaries.
              </p>
              <p>
                It is true, of course, that a translation makes the content
                accessible to a far greater number of people; 84000 has
                therefore consulted many senior Buddhist teachers on this
                question, and most of them felt that to publish the texts openly
                is, on balance, the best solution. The alternatives would be not
                to translate them at all (which would defeat the purposes of the
                whole project), or to place some sort of restriction on their
                access. Restricted access has been tried by some Buddhist book
                publishers, and of course needs a system of administration,
                judgment, and policing that is either a mere formality, or is
                very difficult to implement. It would be even harder to
                implement in the case of electronic texts—and even easier to
                circumvent. Indeed, nowadays practically the whole range of
                traditionally restricted Tibetan Buddhist material is already
                available to anyone who looks for it, and is all too often
                misrepresented, taken out of context, or its secret and esoteric
                nature deliberately vaunted.
              </p>
              <p>
                84000’s policy is to present carefully authenticated
                translations in their proper setting of the whole body of
                Buddhist sacred literature, and to trust the good sense of the
                vast majority of readers not to misuse or misunderstand them.
                Readers are reminded that according to Vajrayāna Buddhist
                tradition there are restrictions and commitments concerning
                tantra. Practitioners who are not sure if they should read
                translations in this section are advised to consult the
                authorities of their lineage. The responsibility, and hence
                consequences, of reading these texts and/or sharing them with
                others who may or may not fulfill the requirements lie in the
                hands of readers.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <DialogFooter>
          <Button
            className="font-sans"
            variant="destructive"
            onClick={() => {
              setIsOpen(false);
              ignore();
            }}
          >
            Don't show again for this text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
