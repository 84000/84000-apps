import { render } from '@testing-library/react';

import { StackRow } from './StackRow';

const column = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-compare-source]');

describe('StackRow Compare column', () => {
  it('is not drawn outside Compare', () => {
    const { container } = render(
      <StackRow uuid="p0" label="1">
        <p>text</p>
      </StackRow>,
    );
    expect(column(container)).toBeNull();
  });

  it('takes the lead it is given beside aligned Tibetan', () => {
    const { container } = render(
      <StackRow uuid="p0" label="1" tibetan="བོད" tibetanLead="md:mt-5">
        <p>text</p>
      </StackRow>,
    );
    expect(column(container)?.classList).toContain('md:mt-5');
    expect(column(container)?.classList).not.toContain('hidden');
  });

  // As the paginated chrome does for a passage with no alignment.
  it('hides with the default lead when there is no Tibetan', () => {
    const { container } = render(
      <StackRow uuid="p0" label="1" tibetan="" tibetanLead="md:mt-5">
        <p>text</p>
      </StackRow>,
    );
    expect(column(container)?.classList).toContain('hidden');
    expect(column(container)?.classList).toContain('md:mt-1');
    expect(column(container)?.classList).not.toContain('md:mt-5');
  });
});

describe('StackRow header and footer', () => {
  it('draws them around the content, outside it and not editable', () => {
    const { container } = render(
      <StackRow
        uuid="p0"
        label="1"
        header={<span data-testid="header">names</span>}
        footer={<span data-testid="footer">link</span>}
      >
        <p data-testid="content">text</p>
      </StackRow>,
    );
    const content = container.querySelector('.passage');
    const header = container.querySelector('[data-testid="header"]');
    const footer = container.querySelector('[data-testid="footer"]');
    expect(content?.contains(header)).toBe(false);
    expect(content?.contains(footer)).toBe(false);
    expect(header && content && header.compareDocumentPosition(content)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(footer && content && footer.compareDocumentPosition(content)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
    expect(header?.parentElement?.getAttribute('contenteditable')).toBe(
      'false',
    );
  });

  it('draws neither when none is given', () => {
    const { container } = render(
      <StackRow uuid="p0" label="1">
        <p>text</p>
      </StackRow>,
    );
    expect(
      container.querySelectorAll('[contenteditable="false"]'),
    ).toHaveLength(0);
  });
});
