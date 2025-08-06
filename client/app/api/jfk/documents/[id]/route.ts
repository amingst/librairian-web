import { NextResponse } from "next/server";

// Sample document content
const getSampleDocumentContent = (id: string) => {
  const documents: Record<string, any> = {
    'sample-doc1': {
      id: 'sample-doc1',
      title: 'JFK Assassination Report',
      content: `
# JFK Assassination Report
## FBI Initial Findings
### November 22, 1963

At approximately 12:30 PM CST on November 22, 1963, President John F. Kennedy was fatally shot while riding in an open motorcade through Dealey Plaza in Dallas, Texas. The President was struck by two bullets: one entering the base of his neck and exiting near the top of his back, and another striking him in the head.

Initial evidence and eyewitness accounts indicate the shots originated from the sixth floor of the Texas School Book Depository building. Lee Harvey Oswald, an employee of the building, was apprehended at 1:50 PM at the Texas Theatre, approximately 4 miles from Dealey Plaza.

The President was rushed to Parkland Memorial Hospital where he was pronounced dead at 1:00 PM CST.

**Key Witnesses:**
- Abraham Zapruder (filmed the assassination)
- Howard Brennan (saw shooter in window)
- Marrion Baker (police officer who encountered Oswald in building)
- Earlene Roberts (Oswald's landlady)

Investigation is ongoing. This report contains preliminary findings only.
      `,
      date: '1963-11-22',
      agency: 'FBI',
      classification: 'Declassified',
      fileType: 'text/markdown',
      pageCount: 3
    },
    'sample-doc2': {
      id: 'sample-doc2',
      title: 'Oswald Background Investigation',
      content: `
# BACKGROUND INVESTIGATION: LEE HARVEY OSWALD
## Central Intelligence Agency
### November 24, 1963

## SUBJECT DETAILS
- **Name:** Lee Harvey Oswald
- **DOB:** October 18, 1939
- **POB:** New Orleans, Louisiana
- **Citizenship:** United States
- **Military Service:** United States Marine Corps (1956-1959)
- **Discharge Status:** Hardship discharge (later changed to dishonorable)

## TIMELINE OF SIGNIFICANT EVENTS

**1959**: Subject defected to the Soviet Union, renouncing US citizenship
- Arrived in Moscow on October 16, 1959
- Attempted suicide when denied Soviet citizenship
- Eventually settled in Minsk, working at radio factory

**1961-1962**: Subject began expressing desire to return to the United States
- Married Marina Prusakova (April 30, 1961) 
- Daughter June born February 15, 1962
- Maintained correspondence with Soviet officials and US Embassy

**1962**: Subject returned to United States with wife and daughter
- Arrived in New York on June 13, 1962
- Settled briefly in Fort Worth, Texas
- Moved to Dallas in October 1962
- Established contact with Russian émigré community

**1963**: Subject activities in Dallas and New Orleans
- Ordered rifle by mail in March 1963 (Mannlicher-Carcano)
- Attempted assassination of General Edwin Walker (April 10, 1963)
- Moved to New Orleans (April-September 1963)
- Established Fair Play for Cuba Committee chapter
- Arrested for disturbing the peace during leafleting
- Visited Mexico City (September 26-October 3, 1963)
  - Visited Cuban and Soviet embassies seeking transit visas
- Returned to Dallas, obtained job at Texas School Book Depository

## ASSOCIATES OF INTEREST
- **George de Mohrenschildt**: Russian émigré, geologist, possible intelligence connections
- **Ruth Paine**: Housing Marina Oswald at time of assassination
- **Michael Paine**: Works at Bell Helicopter, has security clearance
- **Pavel Golovachev**: Soviet friend from Minsk period

## ASSESSMENT
Subject demonstrated erratic behavior, possible psychological instability, and conflicting ideological affiliations. Activities in Mexico City suggest continued interest in Cuba and Soviet Union. Investigation ongoing to determine nature of contacts with foreign governments.
      `,
      date: '1963-11-24',
      agency: 'CIA',
      classification: 'Secret (Declassified 1992)',
      fileType: 'text/markdown',
      pageCount: 37
    },
    'sample-doc3': {
      id: 'sample-doc3',
      title: 'Warren Commission Report - Conclusions',
      content: `
# WARREN COMMISSION REPORT
## Chapter VII: Conclusions
### September 24, 1964

On the basis of the evidence before the Commission, we make the following findings:

1. The shots which killed President Kennedy and wounded Governor Connally were fired from the sixth floor window at the southeast corner of the Texas School Book Depository.

2. The weight of the evidence indicates that there were three shots fired.

3. Although it is not necessary to any essential findings of the Commission to determine just which shot hit Governor Connally, there is very persuasive evidence to indicate that the same bullet which pierced the President's throat also caused Governor Connally's wounds. However, Commission members Gerald Ford, John Sherman Cooper, and Hale Boggs disagreed with this finding.

4. The shots which killed President Kennedy and wounded Governor Connally were fired by Lee Harvey Oswald.

5. Oswald killed Dallas Police Patrolman J.D. Tippit approximately 45 minutes after the assassination.

6. Within 80 minutes of the assassination, and 35 minutes of the Tippit killing, Oswald was arrested in the Texas Theatre by Dallas police.

7. The Commission has found no evidence that either Lee Harvey Oswald or Jack Ruby was part of any conspiracy, domestic or foreign, to assassinate President Kennedy.

8. In its entire investigation, the Commission has found no evidence of conspiracy, subversion, or disloyalty to the U.S. Government by any Federal, State, or local official.

9. On the basis of the evidence before the Commission, it concludes that Oswald acted alone.

10. The Commission has found no evidence that Jack Ruby acted with any co-conspirators.

11. The Commission has found no evidence that Oswald was motivated by a foreign power or domestic radical organization.

12. The Commission believes that the search for a motive must begin with Oswald's character and political views as evidenced by his past actions. The Commission has found considerable evidence that Oswald was an unstable individual with strong resentment towards authority and a desire for personal recognition.

Earl Warren
Chairman
      `,
      date: '1964-09-24',
      agency: 'Warren Commission',
      classification: 'Public Report',
      fileType: 'text/markdown',
      pageCount: 6
    }
  };
  
  // Return the requested document or a 404 error
  return documents[id] || null;
};

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const id = params.id;
    console.log(`[DOCUMENTS API] Request for document: ${id}`);
    
    const document = getSampleDocumentContent(id);
    
    if (!document) {
      console.log(`[DOCUMENTS API] Document not found: ${id}`);
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }
    
    console.log(`[DOCUMENTS API] Returning document: ${id}`);
    return NextResponse.json({
      document,
      status: 'success',
      isSampleData: true
    });
  } catch (error) {
    console.error(`[DOCUMENTS API] Error serving document:`, error);
    return NextResponse.json(
      { 
        error: "Failed to retrieve document",
        details: String(error)
      },
      { status: 500 }
    );
  }
} 