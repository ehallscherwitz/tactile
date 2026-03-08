function Frame() {
  return (
    <div className="absolute content-stretch flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold gap-[24px] items-center justify-center leading-[0] left-[calc(40%+72px)] not-italic text-[32px] text-center text-white top-[920px]">
      <div className="flex flex-col h-[48px] justify-center relative shrink-0 w-[241px]">
        <p className="leading-[36px]">Blue</p>
      </div>
      <div className="flex flex-col h-[48px] justify-center relative shrink-0 w-[187px]">
        <p className="leading-[36px]">#91C1FF</p>
      </div>
    </div>
  );
}

function TopLeft() {
  return (
    <div className="content-stretch flex flex-col gap-[12px] items-start relative shrink-0 w-[594px]" data-name="Top Left">
      <p className="font-['Inter:Regular',sans-serif] font-normal leading-[24px] not-italic relative shrink-0 text-[16px] text-black whitespace-nowrap">Janus Brand Refresh v1</p>
      <div className="flex items-center justify-center relative shrink-0 w-full">
        <div className="flex-none rotate-180 w-full">
          <div className="h-0 relative w-full" data-name="Divider">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 594 2">
                <line id="Divider" stroke="var(--stroke-0, black)" strokeWidth="2" x2="594" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TitlePageCount() {
  return (
    <div className="content-stretch flex font-['Inter:Regular',sans-serif] font-normal items-start justify-between leading-[24px] not-italic relative shrink-0 text-[16px] text-black w-full whitespace-nowrap" data-name="Title + Page Count">
      <p className="relative shrink-0">Info</p>
      <p className="relative shrink-0">&nbsp;</p>
    </div>
  );
}

function TopRight() {
  return (
    <div className="content-stretch flex flex-[1_0_0] flex-col gap-[12px] items-start min-h-px min-w-px relative" data-name="Top Right">
      <TitlePageCount />
      <div className="flex items-center justify-center relative shrink-0 w-full">
        <div className="flex-none rotate-180 w-full">
          <div className="h-0 relative w-full" data-name="Divider">
            <div className="absolute inset-[-2px_0_0_0]">
              <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 1210 2">
                <line id="Divider" stroke="var(--stroke-0, black)" strokeWidth="2" x2="1210" y1="1" y2="1" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Top() {
  return (
    <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-full" data-name="Top">
      <TopLeft />
      <TopRight />
    </div>
  );
}

function Paragraph() {
  return (
    <div className="content-stretch flex flex-[1_0_0] gap-[20px] items-start min-h-px min-w-px relative" data-name="Paragraph">
      <p className="flex-[1_0_0] font-['Inter:Regular',sans-serif] font-normal leading-[28px] min-h-px min-w-px not-italic relative text-[24px] text-black">Our primary color palette/</p>
    </div>
  );
}

function Section1() {
  return (
    <div className="content-stretch flex gap-[20px] items-start relative shrink-0 w-[1824px]" data-name="Section">
      <div className="flex flex-col font-['Inter:Semi_Bold',sans-serif] font-semibold justify-center leading-[0] not-italic relative shrink-0 text-[64px] text-black tracking-[-1.92px] w-[594px]">
        <p className="leading-[72px]">Primary Color</p>
      </div>
      <Paragraph />
    </div>
  );
}

function Section() {
  return (
    <div className="content-stretch flex flex-col gap-[24px] items-start relative shrink-0" data-name="Section">
      <Top />
      <Section1 />
    </div>
  );
}

function SlideHeader() {
  return (
    <div className="absolute content-stretch flex flex-col items-start left-0 px-[48px] py-[32px] top-0" data-name="Slide header">
      <Section />
    </div>
  );
}

export default function SecondaryColors() {
  return (
    <div className="bg-white relative size-full" data-name="Secondary Colors">
      <div className="absolute bg-[#91c1ff] h-[870px] left-0 top-[210px] w-[1920px]" />
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold h-[50px] leading-[36px] left-[calc(80%+203px)] not-italic text-[32px] text-white top-[160px] w-[138px]">#101828</p>
      <Frame />
      <p className="absolute font-['Inter:Semi_Bold',sans-serif] font-semibold h-[51px] leading-[36px] left-[46px] not-italic text-[32px] text-white top-[121px] uppercase w-[132px]">Mirage</p>
      <SlideHeader />
    </div>
  );
}