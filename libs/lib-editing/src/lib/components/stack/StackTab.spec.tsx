import { render, screen } from '@testing-library/react';
import { StackTab } from './StackTab';

const mockStack: { controllerFor: (tab: string) => unknown } = {
  controllerFor: () => undefined,
};
jest.mock('./StackWorkProvider', () => ({ useStackWork: () => mockStack }));
jest.mock('./useStackOuterContent', () => ({
  useStackOuterContent: () => undefined,
}));
jest.mock('./PassageStack', () => ({
  PassageStack: () =>
    jest
      .requireActual('react')
      .createElement('div', { 'data-testid': 'passage-stack' }),
}));
jest.mock('../shared/TranslationSkeleton', () => ({
  TranslationSkeleton: () =>
    jest
      .requireActual('react')
      .createElement('div', { 'data-testid': 'skeleton' }),
}));

const title = <h2>Title</h2>;

describe('StackTab', () => {
  it('draws its title above the stack', () => {
    mockStack.controllerFor = () => ({});
    render(<StackTab tab="bibliography" title={title} />);

    const heading = screen.getByRole('heading', { name: 'Title' });
    const stack = screen.getByTestId('passage-stack');
    expect(
      heading.compareDocumentPosition(stack) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('leaves the title out of the fallback and the skeleton', () => {
    mockStack.controllerFor = () => undefined;
    const { rerender } = render(
      <StackTab tab="bibliography" title={title} fallback={<p>fallback</p>} />,
    );
    expect(screen.getByText('fallback')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();

    rerender(<StackTab tab="bibliography" title={title} />);
    expect(screen.getByTestId('skeleton')).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
  });
});
