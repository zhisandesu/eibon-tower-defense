/* One projection for drawing, mouse input and touch input. */
(function(root){
  'use strict';
  function createBoardProjection({width,height,cols=11,rows=5}){
    // The selected 1672 × 940 shop painting and the deployment surface share one
    // cover transform. Tile perspective therefore stays attached to the floor
    // when the battlefield becomes shallower on a landscape phone.
    const imageScale=Math.max(width/1672,height/940);
    const background={x:(width-1672*imageScale)/2,y:(height-940*imageScale)/2,w:1672*imageScale,h:940*imageScale};
    const top=height*.16,boardHeight=height*.59;
    const depth=t=>.96*t+.04*t*t;
    function rawEdges(y){
      const sourceY=(y-background.y)/background.h;
      return {left:background.x+background.w*(.255-.106*sourceY),right:background.x+background.w*(.914+.080*sourceY)};
    }
    // Fit the original trapezoid as one shape. Clamping each edge independently
    // flattened its perspective in tall windows and made the columns look straight.
    const rawBottom=rawEdges(top+boardHeight),availableLeft=Math.max(width*.12,rawBottom.left),availableRight=width*.86;
    const fitScale=Math.min(1,(availableRight-availableLeft)/(rawBottom.right-rawBottom.left));
    // Scale around the pavement-side edge, not the canvas origin: fitting the
    // right edge must never pull deployment tiles underneath the waiting guards.
    const fitOffset=availableLeft-rawBottom.left*fitScale;
    function edges(y){
      const raw=rawEdges(y);
      return {left:raw.left*fitScale+fitOffset,right:raw.right*fitScale+fitOffset};
    }
    const bottomEdges=edges(top+boardHeight);
    const bounds={x:bottomEdges.left,y:top,w:bottomEdges.right-bottomEdges.left,h:boardHeight};
    function point(x,row){
      const t=row/rows;
      const y=top+boardHeight*depth(t),edge=edges(y);
      return {x:edge.left+(edge.right-edge.left)*x/cols,y};
    }
    function cellAt({x,y}){
      const q=(y-bounds.y)/bounds.h;
      if(q<0||q>=1)return null;
      const t=2*q/(.96+Math.sqrt(.96*.96+.16*q)),edge=edges(y);
      const lane=Math.floor(t*rows),col=Math.floor((x-edge.left)/(edge.right-edge.left)*cols);
      return lane>=0&&lane<rows&&col>=0&&col<cols?{lane,col}:null;
    }
    function corners(x1,x2,row1,row2){return [point(x1,row1),point(x2,row1),point(x2,row2),point(x1,row2)];}
    function guardPoint(lane){
      const y=point(0,lane+.78).y,sourceY=(y-background.y)/background.h;
      return {x:background.x+background.w*(.211-.111*sourceY),y};
    }
    return {bounds,background,point,cellAt,corners,guardPoint,cellWidth:bounds.w/cols,cellHeight:bounds.h/rows};
  }
  root.EibonBoardProjection=createBoardProjection;
  if(typeof module!=='undefined'&&module.exports)module.exports=createBoardProjection;
})(typeof window!=='undefined'?window:globalThis);
