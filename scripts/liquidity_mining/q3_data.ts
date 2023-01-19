interface RewardPeriod {
  rewardPerPeriod: 94017;
  round: number;
  start: number;
  end: number;
  blocks: number;
}
//range: 50,400

/**
 * Q3 phase 1 values
 rewardForLM: 38461,
  rewardForBorrower: 76923,
 */
export const BlockRounds = {
  rewardForLender: 64102,
  //rewardForLM: 38461,
  rewardForBorrower: 51282, //51282,
  blockRanges: [
    //test week
    {
      start: 16384328,
      end: 16386949
    },
    {
      start: 16244257,
      end: 16294657
    },
    {
      start: 16294658,
      end: 16345058
    },
    {
      start: 16345059,
      end: 16395459
    },
    {
      start: 16395460,
      end: 16445860
    },
    {
      start: 16445861,
      end: 16496261
    },
    {
      start: 16496262,
      end: 16546662
    },
    {
      start: 16546663,
      end: 16597063
    },
    {
      start: 16597064,
      end: 16647464
    },
    {
      start: 16647465,
      end: 16697865
    },
    {
      start: 16697866,
      end: 16748266
    },
    {
      start: 16748267,
      end: 16798667
    },
    {
      start: 16798668,
      end: 16849068
    },
    {
      start: 16849069,
      end: 16899469
    }
  ],
};
