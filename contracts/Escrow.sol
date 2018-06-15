pragma solidity ^0.4.23;

contract Escrow {
  modifier byRecepient(){ require(msg.sender == recepient, "Only recepient can call this function"); _; }
  modifier bySender(){ require(msg.sender == sender, "Only sender can call this function");  _; }
  modifier ifPaid(){ require(paid, "Payment must have been made");  _; }
  modifier ifUnpaid(){ require(!paid, "Payment must have NOT been made yet"); _;  }

	event Paid();
	event Refunded();
	event Cancelled();
  
  address public recepient;
  address public sender;

  uint256 public paymentAmount;

  bool public paid;

  uint256 public period1Length;
  uint256 public period2Length;
  uint256 public period3Length;

  uint8 public outsidePeriod1RefundPct;
  uint8 public outsidePeriod2RefundPct;
  uint8 public outsidePeriod3RefundPct;
  uint8 public insidePeriod3RefundPct;

  uint256 public expiresAt;
    
  constructor (uint256 a,
               uint256 p1, uint256 p2, uint256 p3,
               uint8 r1, uint8 r2, uint8 r3, uint8 r4,
               uint256 f) public{
    paid = false;
    
    recepient = msg.sender;
    
    paymentAmount = a;
    
    period1Length = p1;
    period2Length = p2;
    period3Length = p3;

    outsidePeriod1RefundPct = r1;
    outsidePeriod2RefundPct = r2;
    outsidePeriod3RefundPct = r3;
    insidePeriod3RefundPct = r4;

    expiresAt = f;
  }

  function () public ifUnpaid payable {
    require(msg.value == paymentAmount, "The amount sent is incorrect");
    
    sender = msg.sender;
    paid = true;

		emit Paid();
  }

  function release() public bySender ifPaid{
    selfdestruct(recepient);
  }

  function claim() public byRecepient ifPaid{
    require(now >= expiresAt, "The escrow hasn't expired yet.");

    selfdestruct(recepient);
  }

	/* the recepient can cancel the escrow contract returning any and
		 all funds to the sender */
	function cancel() public byRecepient {
		selfdestruct(sender);

		emit Cancelled();
	}

  function refund() public bySender ifPaid{
    require(now < expiresAt, "The escrow has expired.");

    if(now < expiresAt - period1Length){
      sender.transfer(address(this).balance * outsidePeriod1RefundPct/100);
    }else if(now < expiresAt - period2Length){
      sender.transfer(address(this).balance * outsidePeriod2RefundPct/100);
    }else if(now < expiresAt - period3Length){
      sender.transfer(address(this).balance * outsidePeriod3RefundPct/100);
    }else{
      sender.transfer(address(this).balance * insidePeriod3RefundPct/100);
    }

		emit Refunded();

    selfdestruct(recepient);
  }

}
