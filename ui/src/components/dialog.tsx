import type { ReactNode } from "react";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";

type Props = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  wide?: boolean;
};

export function Sheet({ isOpen, onOpenChange, title, children, wide }: Props) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-40 flex items-end justify-center bg-scrim p-0 data-entering:animate-[fade_120ms_ease-out] sm:items-center sm:p-6"
    >
      <Modal
        className={`max-h-[92dvh] w-full overflow-y-auto bg-paper text-ink outline-none data-entering:animate-[rise_160ms_ease-out] ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} border-t-[3px] border-ink sm:border-[3px]`}
      >
        <Dialog className="flex flex-col gap-5 p-5 outline-none sm:p-7">
          {({ close }) => (
            <>
              <Heading slot="title" className="font-display text-3xl leading-tight">
                {title}
              </Heading>
              {typeof children === "function" ? children(close) : children}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
