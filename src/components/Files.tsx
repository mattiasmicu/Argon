import * as React from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { FolderIcon, FolderOpenIcon, FileIcon } from 'lucide-react';

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// Local primitive implementations since animate-ui was removed
type FilesPrimitiveProps = {
  className?: string;
  children: React.ReactNode;
};

const FilesPrimitive = ({ className, children, ...props }: FilesPrimitiveProps & React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-2 w-full', className)} {...props}>{children}</div>
);

const FilesHighlightPrimitive = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('bg-white/5 rounded-lg pointer-events-none', className)} {...props}>{children}</div>
);

const FolderItemPrimitive = ({ value, children, ...props }: { value: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) => (
  <Accordion.Item value={value} {...props}>{children}</Accordion.Item>
);

const FolderHeaderPrimitive = Accordion.Header;

const FolderTriggerPrimitive = ({ children, ...props }: React.HTMLAttributes<HTMLButtonElement>) => (
  <Accordion.Trigger asChild {...props}><button>{children}</button></Accordion.Trigger>
);

const FolderHighlightPrimitive = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
);

const FolderPrimitive = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="flex items-center justify-between gap-2 p-2 pointer-events-none" {...props}>{children}</div>
);

const FolderIconPrimitive = ({ closeIcon, openIcon }: { closeIcon: React.ReactNode; openIcon: React.ReactNode }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return <span onClick={() => setIsOpen(!isOpen)}>{isOpen ? openIcon : closeIcon}</span>;
};

const FolderContentPrimitive = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <Accordion.Content {...props}>{children}</Accordion.Content>
);

const FileHighlightPrimitive = ({ children, onClick, ...props }: React.HTMLAttributes<HTMLDivElement> & { onClick?: () => void }) => (
  <div onClick={onClick} {...props}>{children}</div>
);

const FilePrimitive = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="flex items-center justify-between gap-2 p-2 cursor-pointer" {...props}>{children}</div>
);

const FileIconPrimitive = ({ children }: { children: React.ReactNode }) => (
  <span>{children}</span>
);

// Type definitions
type FolderItemPrimitiveProps = {
  value: string;
  children: React.ReactNode;
};

type FolderContentPrimitiveProps = {
  children: React.ReactNode;
};

type GitStatus = 'untracked' | 'modified' | 'deleted';

type FilesProps = FilesPrimitiveProps;

function Files({ className, children, ...props }: FilesProps) {
  return (
    <FilesPrimitive className={cn('p-2 w-full', className)} {...props}>
      <FilesHighlightPrimitive className="bg-white/5 rounded-lg pointer-events-none">
        {children}
      </FilesHighlightPrimitive>
    </FilesPrimitive>
  );
}

type SubFilesProps = FilesProps;

function SubFiles(props: SubFilesProps) {
  return <FilesPrimitive {...props} />;
}

type FolderItemProps = FolderItemPrimitiveProps;

function FolderItem(props: FolderItemProps) {
  return <FolderItemPrimitive {...props} />;
}

type FolderTriggerProps = React.ComponentPropsWithoutRef<typeof Accordion.Trigger> & {
  gitStatus?: GitStatus;
};

function FolderTrigger({
  children,
  className,
  gitStatus,
  ...props
}: FolderTriggerProps) {
  return (
    <FolderHeaderPrimitive>
      <FolderTriggerPrimitive className="w-full text-start" {...props}>
        <FolderHighlightPrimitive>
          <FolderPrimitive className="flex items-center justify-between gap-2 p-2 pointer-events-none">
            <div
              className={cn(
                'flex items-center gap-2',
                gitStatus === 'untracked' && 'text-green-400',
                gitStatus === 'modified' && 'text-amber-400',
                gitStatus === 'deleted' && 'text-red-400',
              )}
            >
              <FolderIconPrimitive
                closeIcon={<FolderIcon className="size-4.5" />}
                openIcon={<FolderOpenIcon className="size-4.5" />}
              />
              <span className={cn('text-sm', className)}>
                {children}
              </span>
            </div>

            {gitStatus && (
              <span
                className={cn(
                  'rounded-full size-2',
                  gitStatus === 'untracked' && 'bg-green-400',
                  gitStatus === 'modified' && 'bg-amber-400',
                  gitStatus === 'deleted' && 'bg-red-400',
                )}
              />
            )}
          </FolderPrimitive>
        </FolderHighlightPrimitive>
      </FolderTriggerPrimitive>
    </FolderHeaderPrimitive>
  );
}

type FolderContentProps = FolderContentPrimitiveProps;

function FolderContent(props: FolderContentProps) {
  return (
    <div className="relative ml-6 before:absolute before:-left-2 before:inset-y-0 before:w-px before:h-full before:bg-border">
      <FolderContentPrimitive {...props} />
    </div>
  );
}

type FileItemProps = {
  icon?: React.ElementType;
  className?: string;
  children: React.ReactNode;
  gitStatus?: GitStatus;
  onClick?: () => void;
};

function FileItem({
  icon: Icon = FileIcon,
  className,
  children,
  gitStatus,
  onClick,
  ...props
}: FileItemProps) {
  return (
    <FileHighlightPrimitive onClick={onClick}>
      <FilePrimitive
        className={cn(
          'flex items-center justify-between gap-2 p-2 cursor-pointer',
          gitStatus === 'untracked' && 'text-green-400',
          gitStatus === 'modified' && 'text-amber-400',
          gitStatus === 'deleted' && 'text-red-400',
        )}
      >
        <div className="flex items-center gap-2">
          <FileIconPrimitive>
            <Icon className="size-4.5" />
          </FileIconPrimitive>
          <span className={cn('text-sm', className)} {...props}>
            {children}
          </span>
        </div>

        {gitStatus && (
          <span className="text-sm font-medium">
            {gitStatus === 'untracked' && 'U'}
            {gitStatus === 'modified' && 'M'}
            {gitStatus === 'deleted' && 'D'}
          </span>
        )}
      </FilePrimitive>
    </FileHighlightPrimitive>
  );
}

export {
  Files,
  FolderItem,
  FolderTrigger,
  FolderContent,
  FileItem,
  SubFiles,
  type FilesProps,
  type FolderItemProps,
  type FolderTriggerProps,
  type FolderContentProps,
  type FileItemProps,
  type SubFilesProps,
};
