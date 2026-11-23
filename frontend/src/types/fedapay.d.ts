interface FedaPayWidget {
  open(): void;
}

interface FedaPayStatic {
  init(options: {
    public_key: string;
    transaction: { id: number | string };
    onComplete: (reason: string, transaction: unknown) => void;
  }): FedaPayWidget;
  CHECKOUT_COMPLETED: string;
  DIALOG_DISMISSED: string;
}

declare const FedaPay: FedaPayStatic;
