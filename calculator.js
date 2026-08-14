(function () {
  "use strict";

  function $(id) {
    return document.getElementById(id);
  }

  function num(id) {
    const el = $(id);
    if (!el) return 0;

    const value = parseFloat(el.value);
    return Number.isFinite(value) ? value : 0;
  }

  function set(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  function money(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "$0";

    return n.toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD",
      maximumFractionDigits: 0
    });
  }

  function money2(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "$0.00";

    return n.toLocaleString("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function validateLoan(loan, rate, termYears) {
    if (!Number.isFinite(loan) || loan <= 0) {
      return "Please enter a loan amount greater than $0.";
    }

    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      return "Please enter a valid interest rate.";
    }

    if (!Number.isFinite(termYears) || termYears <= 0) {
      return "Please enter a valid loan term.";
    }

    return "";
  }

  /* =========================================================
     CORE LOAN FUNCTIONS
     ========================================================= */

  function monthlyPI(loan, annualRate, months) {
    if (loan <= 0 || months <= 0) return 0;

    const r = annualRate / 100 / 12;

    if (r === 0) {
      return loan / months;
    }

    return (
      loan *
      r *
      Math.pow(1 + r, months) /
      (Math.pow(1 + r, months) - 1)
    );
  }

  function amortise(
    loan,
    annualRate,
    payment,
    maxMonths = 1200,
    extraFn = null
  ) {
    let balance = Math.max(0, loan);
    const r = annualRate / 100 / 12;

    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;

    const rows = [];

    if (balance === 0) {
      return {
        balance: 0,
        totalInterest: 0,
        totalPaid: 0,
        months: 0,
        rows
      };
    }

    while (balance > 0.005 && month < maxMonths) {
      month++;

      const interest = balance * r;

      const extra = extraFn
        ? Math.max(
            0,
            Number(extraFn(month, balance, interest)) || 0
          )
        : 0;

      const scheduled = Math.max(0, payment);

      const actual = Math.min(
        balance + interest,
        scheduled + extra
      );

      if (actual <= 0) break;

      const principal = Math.max(
        0,
        actual - interest
      );

      balance = Math.max(
        0,
        balance - principal
      );

      totalInterest += interest;
      totalPaid += actual;

      rows.push({
        month,
        payment: actual,
        principal,
        interest,
        balance
      });
    }

    return {
      balance,
      totalInterest,
      totalPaid,
      months: month,
      rows
    };
  }

  /* =========================================================
     P&I REPAYMENTS
     ========================================================= */

  function runPI() {
    const loan = num("piLoan");
    const rate = num("piRate");
    const term = num("piTerm");
    const property = num("piPropertyValue");
    const extra = Math.max(0, num("piExtra"));

    const error = validateLoan(
      loan,
      rate,
      term
    );

    if (error) {
      return showError(error);
    }

    const basePayment = monthlyPI(
      loan,
      rate,
      term * 12
    );

    const base = amortise(
      loan,
      rate,
      basePayment,
      term * 12 + 1
    );

    const strategy =
      extra > 0
        ? amortise(
            loan,
            rate,
            basePayment,
            term * 12 + 1,
            () => extra
          )
        : base;

    set("piMonthly", money2(basePayment));
    set("piInterest", money(base.totalInterest));
    set("piTotal", money(base.totalPaid));

    set(
      "piSaved",
      money(
        Math.max(
          0,
          base.totalInterest -
            strategy.totalInterest
        )
      )
    );

    set(
      "piTimeSaved",
      `${Math.max(
        0,
        base.months - strategy.months
      )} months`
    );

    const interestPct =
      base.totalPaid > 0
        ? (base.totalInterest /
            base.totalPaid) *
          100
        : 0;

    set(
      "piInterestPct",
      `${interestPct.toFixed(1)}% interest`
    );

    const principalPct =
      100 - interestPct;

    const principalBar =
      $("piPrincipalBar");

    const interestBar =
      $("piInterestBar");

    if (principalBar) {
      principalBar.style.width =
        `${clamp(
          principalPct,
          0,
          100
        )}%`;
    }

    if (interestBar) {
      interestBar.style.width =
        `${clamp(
          interestPct,
          0,
          100
        )}%`;
    }

    set(
      "piLvr",
      property > 0
        ? `${(
            (loan / property) *
            100
          ).toFixed(1)}%`
        : "—"
    );

    return {
      payment: basePayment,
      interest: base.totalInterest,
      total: base.totalPaid
    };
  }

  /* =========================================================
     EXTRA REPAYMENT
     ========================================================= */

  function simulateExtra(
  loan,
  rate,
  termYears,
  extraMonthly,
  lumpSum,
  extraStart,
  lumpMonth
) {
  const totalMonths = Math.round(termYears * 12);
  const monthlyRate = rate / 100 / 12;

  const normalPayment = monthlyPI(
    loan,
    rate,
    totalMonths
  );

  /*
   * Original loan — no extra repayments
   */
  let normalBalance = loan;
  let normalInterest = 0;
  let normalMonths = 0;

  while (
    normalBalance > 0.005 &&
    normalMonths < totalMonths + 1
  ) {
    normalMonths++;

    const interest =
      normalBalance * monthlyRate;

    const payment = Math.min(
      normalPayment,
      normalBalance + interest
    );

    const principal =
      payment - interest;

    normalBalance = Math.max(
      0,
      normalBalance - principal
    );

    normalInterest += interest;
  }

  /*
   * New strategy
   */
  let balance = loan;
  let totalInterest = 0;
  let totalPaid = 0;
  let newMonths = 0;

  while (
    balance > 0.005 &&
    newMonths < totalMonths + 120
  ) {
    newMonths++;

    /*
     * Interest is calculated from the
     * opening balance for this month.
     */
    const interest =
      balance * monthlyRate;

    /*
     * Normal scheduled payment.
     */
    let payment =
      normalPayment;

    /*
     * Extra monthly payment starts AFTER
     * the specified number of months.
     *
     * 0 = immediately.
     */
    if (
      extraMonthly > 0 &&
      newMonths > extraStart
    ) {
      payment += extraMonthly;
    }

    /*
     * Lump sum:
     *
     * "Paid after X months" means:
     *
     * X = 0 -> no lump sum
     * X = 1 -> after month 1
     * X = 12 -> after month 12
     *
     * Therefore apply it AFTER the normal
     * monthly payment for that month.
     */
    const scheduledPayment =
      Math.min(
        payment,
        balance + interest
      );

    const principal =
      Math.max(
        0,
        scheduledPayment - interest
      );

    balance =
      Math.max(
        0,
        balance - principal
      );

    totalInterest += interest;
    totalPaid += scheduledPayment;

    /*
     * Apply lump sum after the selected
     * month's normal payment.
     */
    if (
      lumpSum > 0 &&
      lumpMonth > 0 &&
      newMonths === lumpMonth &&
      balance > 0
    ) {
      const actualLump = Math.min(
        lumpSum,
        balance
      );

      balance -= actualLump;
      totalPaid += actualLump;
    }
  }

  return {
    basePayment: normalPayment,

    normalInterest,
    normalMonths,

    newInterest: totalInterest,
    newMonths,

    interestSaved: Math.max(
      0,
      normalInterest - totalInterest
    ),

    monthsSaved: Math.max(
      0,
      normalMonths - newMonths
    ),

    totalPaid
  };
}

  function runExtra() {
  const loan = Math.max(0, num("erLoan"));
  const rate = Math.max(0, num("erRate"));
  const term = Math.max(1, num("erTerm"));

  const extra = Math.max(
    0,
    num("erExtra")
  );

  const lump = Math.max(
    0,
    num("erLump")
  );

  const extraStart = Math.max(
    0,
    Math.floor(num("erExtraStart"))
  );

  const lumpMonth = Math.max(
    0,
    Math.floor(num("erLumpMonth"))
  );

  const error = validateLoan(
    loan,
    rate,
    term
  );

  if (error) {
    return showError(error);
  }

  /*
   * Nothing extra to calculate.
   */
  if (
    extra === 0 &&
    lump === 0
  ) {
    set("erSaved", money(0));
    set("erTime", "0 months");

    const normalPayment =
      monthlyPI(
        loan,
        rate,
        term * 12
      );

    const normal =
      amortise(
        loan,
        rate,
        normalPayment,
        term * 12 + 1
      );

    set(
      "erNormalInterest",
      money(normal.totalInterest)
    );

    set(
      "erNewInterest",
      money(normal.totalInterest)
    );

    set(
      "erNewTerm",
      `${normal.months} months`
    );

    return normal;
  }

  /*
   * If a lump sum is entered, require
   * a month at which it is applied.
   */
  if (
    lump > 0 &&
    lumpMonth === 0
  ) {
    return showError(
      "Enter the month after which the lump sum will be paid."
    );
  }

  const result = simulateExtra(
    loan,
    rate,
    term,
    extra,
    lump,
    extraStart,
    lumpMonth
  );

  set(
    "erSaved",
    money(result.interestSaved)
  );

  set(
    "erTime",
    `${result.monthsSaved} months`
  );

  set(
    "erNormalInterest",
    money(result.normalInterest)
  );

  set(
    "erNewInterest",
    money(result.newInterest)
  );

  set(
    "erNewTerm",
    `${result.newMonths} months`
  );

  return result;
}

  /* =========================================================
     INTEREST ONLY
     ========================================================= */

  function runIO() {
    const loan = num("ioLoan");
    const rate = num("ioRate");
    const term = num("ioTerm");
    const ioYears = num("ioPeriod");

    const error =
      validateLoan(
        loan,
        rate,
        term
      );

    if (error) {
      return showError(error);
    }

    if (
      ioYears < 0 ||
      ioYears >= term
    ) {
      return showError(
        "The interest-only period must be shorter than the total loan term."
      );
    }

    const ioMonths =
      Math.round(
        ioYears * 12
      );

    const remainingMonths =
      Math.max(
        1,
        Math.round(
          term * 12
        ) - ioMonths
      );

    const monthlyIO =
      loan *
      (rate / 100) /
      12;

    const ioInterest =
      monthlyIO *
      ioMonths;

    const piPayment =
      monthlyPI(
        loan,
        rate,
        remainingMonths
      );

    set(
      "ioPayment",
      money2(monthlyIO)
    );

    set(
      "ioPi",
      money2(piPayment)
    );

    set(
      "ioInterest",
      money(ioInterest)
    );

    set(
      "ioBalance",
      money(loan)
    );

    set(
      "ioRemaining",
      `${(
        remainingMonths / 12
      ).toFixed(1)} years`
    );

    return {
      monthlyIO,
      piPayment,
      ioInterest,
      balance: loan
    };
  }

  /* =========================================================
     IO VS P&I
     ========================================================= */

  function runCompare() {
    const loan = num("cmpLoan");
    const piRate = num("cmpPiRate");
    const ioRate = num("cmpIoRate");
    const term = num("cmpTerm");
    const ioPeriod = num("cmpPeriod");
    const taxRate = num("cmpTax");

    const error =
      validateLoan(
        loan,
        piRate,
        term
      );

    if (error) {
      return showError(error);
    }

    if (
      ioPeriod < 0 ||
      ioPeriod >= term
    ) {
      return showError(
        "The IO period must be shorter than the total loan term."
      );
    }

    const piPayment =
      monthlyPI(
        loan,
        piRate,
        term * 12
      );

    const pi =
      amortise(
        loan,
        piRate,
        piPayment,
        term * 12 + 1
      );

    const ioMonths =
      Math.round(
        ioPeriod * 12
      );

    const remaining =
      Math.max(
        1,
        Math.round(
          term * 12
        ) - ioMonths
      );

    const ioPayment =
      loan *
      (ioRate / 100) /
      12;

    const ioInterest =
      ioPayment *
      ioMonths;

    const postIO =
      monthlyPI(
        loan,
        ioRate,
        remaining
      );

    const postIOAmort =
      amortise(
        loan,
        ioRate,
        postIO,
        remaining + 1
      );

    const ioTotalInterest =
      ioInterest +
      postIOAmort.totalInterest;

    const difference =
      ioTotalInterest -
      pi.totalInterest;

    const afterTax =
      difference *
      (
        1 -
        clamp(
          taxRate / 100,
          0,
          1
        )
      );

    set(
      "cmpPiPayment",
      money2(piPayment)
    );

    set(
      "cmpPiInterest",
      money(pi.totalInterest)
    );

    set(
      "cmpIoPayment",
      money2(ioPayment)
    );

    set(
      "cmpIoInterest",
      money(ioTotalInterest)
    );

    set(
      "cmpAfterTax",
      money(afterTax)
    );

    return {
      piPayment,
      piInterest:
        pi.totalInterest,
      ioPayment,
      ioInterest:
        ioTotalInterest,
      afterTax
    };
  }

  /* =========================================================
     BORROWING POWER
     ========================================================= */

  function australianResidentTax(
    income
  ) {
    if (income <= 18200)
      return 0;

    if (income <= 45000)
      return (
        income - 18200
      ) * 0.16;

    if (income <= 135000)
      return (
        4288 +
        (income - 45000) *
          0.30
      );

    if (income <= 190000)
      return (
        31288 +
        (income - 135000) *
          0.37
      );

    return (
      51638 +
      (income - 190000) *
        0.45
    );
  }

  function presentValueOfPayment(
    payment,
    annualRate,
    months
  ) {
    if (
      payment <= 0 ||
      months <= 0
    ) {
      return 0;
    }

    const r =
      annualRate /
      100 /
      12;

    if (r === 0) {
      return payment * months;
    }

    return (
      payment *
      (
        1 -
        Math.pow(
          1 + r,
          -months
        )
      ) /
      r
    );
  }

  function runBorrowing() {
    const income =
      Math.max(
        0,
        num("bpIncome")
      );

    const partner =
      Math.max(
        0,
        num("bpPartner")
      );

    const dependants =
      Math.max(
        0,
        Math.floor(
          num("bpDependants")
        )
      );

    const living =
      Math.max(
        0,
        num("bpLiving")
      );

    const debts =
      Math.max(
        0,
        num("bpDebts")
      );

    const cards =
      Math.max(
        0,
        num("bpCards")
      );

    const rate =
      Math.max(
        0,
        num("bpRate")
      );

    const term =
      Math.max(
        1,
        num("bpTerm")
      );

    const type =
      $("bpType")
        ? $("bpType").value
        : "pi";

    const gross =
      income + partner;

    const annualTax =
      australianResidentTax(
        gross
      );

    const netMonthly =
      Math.max(
        0,
        (gross - annualTax) /
          12
      );

    const dependantExpense =
      dependants * 450;

    const cardAssessment =
      cards * 0.03;

    const available =
      Math.max(
        0,
        netMonthly -
          living -
          debts -
          dependantExpense -
          cardAssessment
      );

    const maxLoan =
      type === "io"
        ? (
            rate > 0
              ? available /
                (rate / 100 / 12)
              : available *
                term *
                12
          )
        : presentValueOfPayment(
            available,
            rate,
            term * 12
          );

    const payment =
      type === "io"
        ? maxLoan *
          (rate / 100) /
          12
        : monthlyPI(
            maxLoan,
            rate,
            term * 12
          );

    set(
      "bpResult",
      money(maxLoan)
    );

    set(
      "bpGross",
      money(gross)
    );

    set(
      "bpNet",
      money(netMonthly)
    );

    set(
      "bpPayment",
      money(payment)
    );

    set(
      "bpBuffer",
      money(
        Math.max(
          0,
          available - payment
        )
      )
    );

    return {
      maxLoan,
      gross,
      netMonthly,
      payment,
      available
    };
  }

  /* =========================================================
     STAMP DUTY
     ========================================================= */

  const dutyRates = {
    NSW: {
      threshold: 0,
      base: 0,
      rate: 0.045
    },

    VIC: {
      threshold: 0,
      base: 0,
      rate: 0.055
    },

    QLD: {
      threshold: 0,
      base: 0,
      rate: 0.045
    },

    SA: {
      threshold: 0,
      base: 0,
      rate: 0.055
    },

    WA: {
      threshold: 0,
      base: 0,
      rate: 0.055
    },

    TAS: {
      threshold: 0,
      base: 0,
      rate: 0.045
    },

    ACT: {
      threshold: 0,
      base: 0,
      rate: 0.05
    },

    NT: {
      threshold: 0,
      base: 0,
      rate: 0.055
    }
  };

  function runStamp() {
    const value =
      Math.max(
        0,
        num("sdValue")
      );

    const state =
      $("sdState")
        ? $("sdState").value
        : "NSW";

    const foreign =
      $("sdForeign")
        ? $("sdForeign").value === "yes"
        : false;

    const fhb =
      $("sdFhb")
        ? $("sdFhb").value === "yes"
        : false;

    const buyer =
      $("sdBuyer")
        ? $("sdBuyer").value
        : "owner";

    const property =
      $("sdProperty")
        ? $("sdProperty").value
        : "established";

    const model =
      dutyRates[state] ||
      dutyRates.NSW;

    const base =
      Math.max(
        0,
        (
          value -
          model.threshold
        ) *
          model.rate +
          model.base
      );

    let concession = 0;

    if (
      fhb &&
      buyer === "owner" &&
      property !== "vacant"
    ) {
      concession =
        Math.min(
          base,
          value < 800000
            ? base * 0.5
            : 0
        );
    }

    const foreignSurcharge =
      foreign
        ? value * 0.08
        : 0;

    const duty =
      Math.max(
        0,
        base -
          concession +
          foreignSurcharge
      );

    const cash =
      value + duty;

    set(
      "sdDuty",
      money(duty)
    );

    set(
      "sdBase",
      money(base)
    );

    set(
      "sdSurcharge",
      money(
        foreignSurcharge
      )
    );

    set(
      "sdConcession",
      money(concession)
    );

    set(
      "sdCash",
      money(cash)
    );

    return {
      duty,
      base,
      foreignSurcharge,
      concession,
      cash
    };
  }

  /* =========================================================
     TAX DEDUCTIONS
     ========================================================= */

  function runTax() {
    const loan =
      Math.max(
        0,
        num("taxLoan")
      );

    const rate =
      Math.max(
        0,
        num("taxRate")
      );

    const rent =
      Math.max(
        0,
        num("taxRent")
      );

    const expenses =
      Math.max(
        0,
        num("taxExpenses")
      );

    const depreciation =
      Math.max(
        0,
        num("taxDep")
      );

    const taxRate =
      clamp(
        num("taxRateSelect") /
          100,
        0,
        1
      );

    const annualInterest =
      loan *
      rate /
      100;

    const deductibleCosts =
      annualInterest +
      expenses +
      depreciation;

    const netRental =
      rent -
      deductibleCosts;

    const taxSaving =
      deductibleCosts *
      taxRate;

    const cashflowAfterTax =
      netRental +
      taxSaving;

    set(
      "taxDeduction",
      money(deductibleCosts)
    );

    set(
      "taxInterest",
      money(annualInterest)
    );

    set(
      "taxNet",
      money(netRental)
    );

    set(
      "taxSaving",
      money(taxSaving)
    );

    set(
      "taxCashflow",
      money(
        cashflowAfterTax
      )
    );

    return {
      annualInterest,
      deductibleCosts,
      netRental,
      taxSaving,
      cashflowAfterTax
    };
  }

  /* =========================================================
     LAND TAX
     ========================================================= */

  const landTaxModels = {
    NSW: [1000000, 0.016],
    VIC: [500000, 0.013],
    QLD: [600000, 0.0175],
    SA: [450000, 0.005],
    WA: [300000, 0.025],
    TAS: [100000, 0.0055],
    ACT: [0, 0.009],
    NT: [0, 0]
  };

  function runLandTax() {
  const value = Math.max(
    0,
    num("ltValue")
  );

  const state =
    $("ltState")
      ? $("ltState").value
      : "NSW";

  const owner =
    $("ltOwner")
      ? $("ltOwner").value
      : "individual";

  if (value <= 0) {
    return showError(
      "Please enter a land value greater than $0."
    );
  }

  /*
   * Principal place of residence
   *
   * For the calculator's simplified
   * estimate, treat the home as exempt.
   */
  if (owner === "home") {
    set("ltResult", money(0));
    set("ltStateOut", state);
    set("ltThreshold", "Exempt");
    set("ltTaxable", money(0));
    set("ltRate", "0%");

    return {
      result: 0,
      taxable: 0,
      rate: 0
    };
  }

  let tax = 0;
  let threshold = 0;
  let taxable = 0;
  let topRate = 0;

  /*
   * =========================================================
   * NSW — 2026
   * =========================================================
   */

  if (state === "NSW") {
    const generalThreshold =
      1075000;

    const premiumThreshold =
      6571000;

    /*
     * General land tax
     */
    if (
      owner === "individual"
    ) {
      if (
        value <= generalThreshold
      ) {
        tax = 0;
        threshold =
          generalThreshold;
        taxable = 0;
        topRate = 0;
      } else if (
        value <= premiumThreshold
      ) {
        taxable =
          value -
          generalThreshold;

        tax =
          100 +
          taxable * 0.016;

        threshold =
          generalThreshold;

        topRate = 1.6;
      } else {
        taxable =
          value -
          premiumThreshold;

        tax =
          88036 +
          taxable * 0.02;

        threshold =
          premiumThreshold;

        topRate = 2;
      }
    }

    /*
     * Trusts are deliberately treated
     * conservatively here because NSW
     * trust rules can remove the normal
     * threshold depending on trust type.
     */
    else if (
      owner === "trust"
    ) {
      /*
       * Simplified trust estimate:
       * no general tax-free threshold.
       */
      if (
        value <= premiumThreshold
      ) {
        tax =
          value * 0.016;

        threshold = 0;
        taxable = value;
        topRate = 1.6;
      } else {
        tax =
          88036 +
          (
            value -
            premiumThreshold
          ) * 0.02;

        threshold = 0;
        taxable = value;
        topRate = 2;
      }
    }

    /*
     * Foreign / absentee owner
     *
     * NSW surcharge land tax has
     * separate rules and no general
     * tax-free threshold.
     */
    else if (
      owner === "foreign"
    ) {
      /*
       * 2026 NSW surcharge rate:
       * 5% of taxable residential
       * land value.
       *
       * This is shown as a simplified
       * surcharge estimate.
       */
      tax =
        value * 0.05;

      threshold = 0;
      taxable = value;
      topRate = 5;
    }
  }

  /*
   * =========================================================
   * SOUTH AUSTRALIA — 2026/27
   * =========================================================
   *
   * SA uses progressive tiers.
   */

  else if (
    state === "SA"
  ) {
    if (
      value <= 936000
    ) {
      tax = 0;
      threshold = 936000;
      taxable = 0;
      topRate = 0;
    } else if (
      value <= 1504000
    ) {
      tax =
        (
          value -
          936000
        ) * 0.005;

      threshold = 936000;
      taxable =
        value - 936000;
      topRate = 0.5;
    } else if (
      value <= 2188000
    ) {
      tax =
        2840 +
        (
          value -
          1504000
        ) * 0.01;

      threshold = 1504000;
      taxable =
        value - 1504000;
      topRate = 1;
    } else if (
      value <= 3504000
    ) {
      tax =
        9680 +
        (
          value -
          2188000
        ) * 0.02;

      threshold = 2188000;
      taxable =
        value - 2188000;
      topRate = 2;
    } else {
      tax =
        36000 +
        (
          value -
          3504000
        ) * 0.024;

      threshold = 3504000;
      taxable =
        value - 3504000;
      topRate = 2.4;
    }
  }

  /*
   * =========================================================
   * OTHER STATES
   * =========================================================
   *
   * Keep the calculator functional,
   * but do not pretend the simplified
   * model is an official calculation.
   */

  else {
    const fallback = {
      VIC: {
        threshold: 500000,
        rate: 0.013
      },

      QLD: {
        threshold: 600000,
        rate: 0.0175
      },

      WA: {
        threshold: 300000,
        rate: 0.025
      },

      TAS: {
        threshold: 100000,
        rate: 0.0055
      },

      ACT: {
        threshold: 0,
        rate: 0.009
      },

      NT: {
        threshold: 0,
        rate: 0
      }
    };

    const model =
      fallback[state] ||
      fallback.VIC;

    threshold =
      model.threshold;

    taxable =
      Math.max(
        0,
        value -
          threshold
      );

    tax =
      taxable *
      model.rate;

    topRate =
      model.rate * 100;
  }

  /*
   * Safety
   */
  tax = Math.max(
    0,
    tax
  );

  set(
    "ltResult",
    money(tax)
  );

  set(
    "ltStateOut",
    state
  );

  set(
    "ltThreshold",
    threshold === 0
      ? "$0"
      : money(threshold)
  );

  set(
    "ltTaxable",
    money(taxable)
  );

  set(
    "ltRate",
    `${topRate.toFixed(2)}%`
  );

  return {
    result: tax,
    threshold,
    taxable,
    rate: topRate
  };
}
  /* =========================================================
     AMORTISATION SCHEDULE
     ========================================================= */

 function runSchedule() {
  const loan = Math.max(
    0,
    num("amLoan")
  );

  const rate = Math.max(
    0,
    num("amRate")
  );

  const term = Math.max(
    1,
    num("amTerm")
  );

  const type =
    $("amType")
      ? $("amType").value
      : "pi";

  const ioYears = Math.max(
    0,
    num("amIO")
  );

  const extra = Math.max(
    0,
    num("amExtra")
  );

  const error = validateLoan(
    loan,
    rate,
    term
  );

  if (error) {
    return showError(error);
  }

  const totalMonths =
    Math.round(term * 12);

  /*
   * IO period cannot equal or exceed
   * the entire loan term.
   */
  let ioMonths = 0;

  if (type === "io") {
    ioMonths = Math.round(
      ioYears * 12
    );

    if (ioMonths >= totalMonths) {
      return showError(
        "The interest-only period must be shorter than the total loan term."
      );
    }
  }

  const monthlyRate =
    rate / 100 / 12;

  let balance = loan;

  let totalInterest = 0;
  let totalPaid = 0;

  const rows = [];

  /*
   * ---------------------------------------------------------
   * PHASE 1 — INTEREST ONLY
   * ---------------------------------------------------------
   */

  if (
    type === "io" &&
    ioMonths > 0
  ) {
    const ioPayment =
      loan * monthlyRate;

    for (
      let month = 1;
      month <= ioMonths;
      month++
    ) {
      const openingBalance =
        balance;

      const interest =
        openingBalance *
        monthlyRate;

      /*
       * IO payment contains interest only.
       */
      const payment =
        interest;

      const principal = 0;

      balance =
        openingBalance;

      totalInterest += interest;
      totalPaid += payment;

      rows.push({
        month,
        type: "IO",
        payment,
        principal,
        interest,
        balance,
        cumInterest:
          totalInterest
      });
    }
  }

  function renderSchedule(rows) {
  const body =
    $("amortisationBody");

  if (!body) return;

  if (!rows.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7">
          No schedule available.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = rows
    .map(row => `
      <tr>
        <td>${row.month}</td>

        <td>
          ${row.type}
        </td>

        <td>
          ${money2(row.payment)}
        </td>

        <td>
          ${money2(row.principal)}
        </td>

        <td>
          ${money2(row.interest)}
        </td>

        <td>
          ${money2(row.balance)}
        </td>

        <td>
          ${money2(row.cumInterest)}
        </td>
      </tr>
    `)
    .join("");
}
  /*
   * ---------------------------------------------------------
   * PHASE 2 — PRINCIPAL & INTEREST
   * ---------------------------------------------------------
   *
   * The remaining term starts after the
   * IO period.
   */

  const remainingMonths =
    totalMonths - ioMonths;

  const piPayment =
    monthlyPI(
      balance,
      rate,
      remainingMonths
    );

  /*
   * Display the first payment:
   *
   * IO loan -> show IO payment
   * P&I loan -> show P&I payment
   */
  const initialPayment =
    type === "io" &&
    ioMonths > 0
      ? loan * monthlyRate
      : piPayment;

  /*
   * P&I phase
   */
  for (
    let i = 1;
    i <= remainingMonths &&
    balance > 0.005;
    i++
  ) {
    const month =
      ioMonths + i;

    const openingBalance =
      balance;

    const interest =
      openingBalance *
      monthlyRate;

    /*
     * Extra repayment is added
     * on top of the scheduled P&I payment.
     */
    let payment =
      piPayment + extra;

    /*
     * Never charge more than the
     * amount required to clear the loan.
     */
    payment =
      Math.min(
        payment,
        openingBalance +
          interest
      );

    const principal =
      Math.max(
        0,
        payment - interest
      );

    balance =
      Math.max(
        0,
        openingBalance -
          principal
      );

    totalInterest += interest;
    totalPaid += payment;

    rows.push({
      month,
      type: "P&I",
      payment,
      principal,
      interest,
      balance,
      cumInterest:
        totalInterest
    });
  }

  /*
   * Update summary.
   */

  set(
    "amPayment",
    money2(initialPayment)
  );

  set(
    "amInterest",
    money(totalInterest)
  );

  set(
    "amTotal",
    money(totalPaid)
  );

  set(
    "amMonths",
    String(rows.length)
  );

  set(
    "amStart",
    money(loan)
  );

  renderSchedule(rows);

  return {
    payment: initialPayment,
    interest: totalInterest,
    total: totalPaid,
    months: rows.length,
    rows
  };
}
  /* =========================================================
     ERROR HANDLING
     ========================================================= */

  function showError(message) {
    let box =
      $("calculatorError");

    if (!box) {
      box =
        document.createElement(
          "div"
        );

      box.id =
        "calculatorError";

      box.setAttribute(
        "role",
        "alert"
      );

      box.style.cssText =
        `
        position:fixed;
        right:20px;
        bottom:20px;
        z-index:9999;
        max-width:420px;
        padding:14px 18px;
        border-radius:12px;
        background:#8b1e1e;
        color:#fff;
        box-shadow:0 10px 30px rgba(0,0,0,.2);
        font:600 14px/1.4 system-ui,sans-serif;
        `;

      document.body.appendChild(
        box
      );
    }

    box.textContent =
      message;

    clearTimeout(
      box._timer
    );

    box._timer =
      setTimeout(
        () => {
          if (box.parentNode) {
            box.remove();
          }
        },
        4500
      );

    return null;
  }

  /* =========================================================
     ACTION MAP
     ========================================================= */

  const actions = {
    pi: runPI,
    extra: runExtra,
    io: runIO,
    compare: runCompare,
    borrowing: runBorrowing,
    stamp: runStamp,
    tax: runTax,
    "land-tax": runLandTax,
    schedule: runSchedule
  };

  /* =========================================================
     CALCULATOR TABS
     ========================================================= */

  function activateCalculator(
    name
  ) {
    document
      .querySelectorAll(
        ".calc-tab"
      )
      .forEach(btn => {
        btn.classList.toggle(
          "active",
          btn.dataset.calculator ===
            name
        );
      });

    document
      .querySelectorAll(
        ".calc-panel"
      )
      .forEach(panel => {
        panel.classList.remove(
          "active"
        );
      });

    const panel =
      $(`panel-${name}`);

    if (panel) {
      panel.classList.add(
        "active"
      );
    }
  }

  function activateCategory(
    category
  ) {
    document
      .querySelectorAll(
        ".calculator-category"
      )
      .forEach(btn => {
        btn.classList.toggle(
          "active",
          btn.dataset.category ===
            category
        );
      });

    document
      .querySelectorAll(
        ".calculator-group"
      )
      .forEach(group => {
        group.classList.toggle(
          "active",
          group.dataset.group ===
            category
        );
      });

    const first =
      document.querySelector(
        `.calculator-group[data-group="${CSS.escape(
          category
        )}"] .calc-tab`
      );

    if (first) {
      activateCalculator(
        first.dataset.calculator
      );
    }
  }

  /* =========================================================
     EVENT BINDING
     ========================================================= */

  function bind() {

    /* Category buttons */

    document
      .querySelectorAll(
        ".calculator-category"
      )
      .forEach(btn => {
        btn.addEventListener(
          "click",
          () => {
            activateCategory(
              btn.dataset.category
            );
          }
        );
      });

    /* Calculator tabs */

    document
      .querySelectorAll(
        ".calc-tab"
      )
      .forEach(btn => {
        btn.addEventListener(
          "click",
          () => {
            activateCalculator(
              btn.dataset.calculator
            );
          }
        );
      });

    /* Calculate buttons */

    document
      .querySelectorAll(
        ".calc-action"
      )
      .forEach(btn => {
        btn.addEventListener(
          "click",
          event => {
            event.preventDefault();

            const action =
              btn.dataset.action;

            if (
              typeof actions[action] ===
              "function"
            ) {
              actions[action]();
            } else {
              showError(
                `Calculator action "${action}" is not configured.`
              );
            }
          }
        );
      });

    /* Schedule toggle */

    const toggle =
      $("toggleSchedule");

    const wrapper =
      $("scheduleTableWrapper");

    if (
      toggle &&
      wrapper
    ) {
      toggle.addEventListener(
        "click",
        () => {
          const showing =
            wrapper.classList.toggle(
              "show"
            );

          toggle.textContent =
            showing
              ? "Hide schedule"
              : "Show schedule";
        }
      );
    }

    /* Footer year */

    set(
      "footerYear",
      String(
        new Date().getFullYear()
      )
    );

    /* Calculate P&I on initial load */

    runPI();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window.SILAMCalculator = {
    monthlyPI,
    amortise,
    simulateExtra,
    australianResidentTax,
    presentValueOfPayment,
    actions
  };

  /* =========================================================
     START
     ========================================================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      bind,
      { once: true }
    );
  } else {
    bind();
  }

})();