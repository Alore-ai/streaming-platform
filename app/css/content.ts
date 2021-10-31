import styled from "styled-components";

export const Block = styled.div`
    margin-top: 10rem;
`;

export const NegativeBlock = styled.div`
    margin-top: -10rem;
`;

export const Content = styled.div<{ breakMobile?: boolean; breakDesktop?: boolean }>`
    margin: 0 2rem;

    @media ${p => p.theme.bp.l} {
        max-width: 150rem;
        width: calc(100% - 20rem);
        margin-right: auto;
        margin-left: auto;
    }
`;

export const aspectRatio = (abs: number) => `
    position: relative;

    &::after {
        content: "";
        display: block;
        padding-bottom: ${100 * abs}%;
    }
`;

export const square = (value: string) => `
    height: ${value};
    width: ${value};
`;

export const fillParent = () => `
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
`;