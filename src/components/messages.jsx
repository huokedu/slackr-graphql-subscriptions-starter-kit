import 'bootstrap/dist/css/bootstrap.min.css';
import styles from './index.scss';
import React from 'react';
import { Link } from 'react-router';
import { graphql, compose } from 'react-apollo';
import gql from 'graphql-tag';

const LoggedInUserQuery = gql`
query LoggedInUser {
  viewer {
    user {
      id
      username
      nickname
    }
  }
}
`;

const ChannelMessagesQuery = gql`
query GetPublicChannels($channelId: ID!, $messageOrder: [MessageOrderByArgs]) {
  getChannel(id: $channelId) {
    id
    name
    messages(last: 50, orderBy: $messageOrder) {
      edges {
        node {
          id
          content
          createdAt
          author {
            id
            username
            nickname
            picture
          }
        }
      }
    }
  }
}
`;

const CreateMessageQuery = gql`
mutation CreateMessage($message: CreateMessageInput!) {
  createMessage(input: $message) {
    changedMessage {
      id
      content
      author {
        id
        username
        nickname
        picture
      }
    }
  }
}
`;

const SearchMessagesQuery = gql`
query SearchMessages ($searchTerm: String!) {
  viewer {
    searchAlgoliaMessages (query: $searchTerm) {
      nbHits
      hits {
        objectID
        _highlightResult
        node {
          id
          content
          channel {
            id
            name
            isPublic @skip(if: false)
          }
          author {
            id
            username
          }
        }
      }
    }
  }
}
`;

class Messages extends React.Component {

  constructor(props: any) {
    super(props);
    this.onNewMessageChange = this.onNewMessageChange.bind(this);
    this.submitMessage = this.submitMessage.bind(this);
    this.onSearchInputChange = this.onSearchInputChange.bind(this);
    this.state = {
      newMessage: '',
      searchValue: '',
    };
  }

  subscribeToNewMessages() {
    this.subscription = this.props.data.subscribeToMore({
      document: gql`
        subscription newMessages($subscriptionFilter:MessageSubscriptionFilter) {
          subscribeToMessage(mutations:[createMessage], filter: $subscriptionFilter) {
            value {
              id
              content
              createdAt
              author {
                id
                username
                nickname
                picture
              }
            }
          }
        }
      `,
      variables: {
        subscriptionFilter: {
          channelId: {
            eq: this.props.params ? this.props.params.channelId : null
          }
        }
      },
      updateQuery: (prev, { subscriptionData }) => {
        const newEdges = [
          ...prev.getChannel.messages.edges,
          {
            node: {
              ...subscriptionData.data.subscribeToMessage.value,
            }
          }
        ];
        return {
          getChannel: {
            messages: {
              edges: newEdges,
            }
          }
        };
      },
    });
  }

  componentWillReceiveProps(newProps) {
    if (
      !newProps.data.loading &&
      newProps.data.getChannel
    ) {
      if (
        !this.props.data.getChannel ||
        newProps.data.getChannel.id !== this.props.data.getChannel.id
      ) {
        // If we change channels, subscribe to the new channel
        this.subscribeToNewMessages();
      }
    }
  }

  onSearchInputChange(e) {
    if (e.target.value && e.target.value !== '') {
      this.props.refetchSearchResults({ searchTerm: e.target.value });
    }
    this.setState({
      searchValue: e.target.value,
    });
  }

  onNewMessageChange(e) {
    this.setState({
      newMessage: e.target.value,
    });
  }

  submitMessage(e) {
    if (e) {
      e.preventDefault();
    }
    const that = this;
    this.props.createMessage({
      content: this.state.newMessage,
      channelId: this.props.data.getChannel.id,
      authorId: this.props.loggedInUser ? this.props.loggedInUser.id : undefined
    }).then(() => {
      that.setState({
        newMessage: ''
      });
    });
  }

  render() {
    return this.props.data.getChannel ?
      (
        <div className={styles.messagePage}>
          <div className={styles.messageHeaderWrapper}>
            <div style={{ float: 'left' }}><h3>{this.props.data.getChannel.name}</h3></div>
            <div style={{ float: 'right' }}>
              <input type="text" placeholder="Search Messages" value={this.state.searchValue} onChange={this.onSearchInputChange} className="form-control" />
            </div>
          </div>
          <div className={styles.messageListWrapper}>
            <div className="row">
              <div className="col-lg-8 col-md-8 col-sm-8">
                <ul>
                  {
                    this.props.data.getChannel.messages.edges.map(edge => (
                      <li key={edge.node.id}>
                        <div className={styles.messageBlock}>
                          {
                            edge.node.author && edge.node.author.picture ?
                              <img
                                style={{ width: '30px', height: '30px', borderRadius: '15px', float: 'left', marginLeft: '-36px', marginTop: '10px' }}
                                src={edge.node.author.picture}
                              /> :
                              null
                          }
                          <div className={styles.messageContent}>
                            <div className={styles.messageHeader}>
                              <h6>
                                {
                                  edge.node.author ?
                                    (edge.node.author.nickname || edge.node.author.username) :
                                    'Anonymous'
                                }
                              </h6>
                              <span className="text-muted">
                                {new Date(edge.node.createdAt).toISOString().substr(11, 5)}
                              </span>
                            </div>
                            <div>
                              {edge.node.content}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  }
                </ul>
              </div>
              <div className="col-lg-4 col-md-4 col-sm-4" style={{ borderLeft: '1px solid #ccc' }}>
                <div className={styles.searchResultsWrapper}>
                  <div className={styles.searchResultsHeader}>
                    <h4>Search Results</h4>
                    <div className={styles.searchResultsAlgolia}>
                      Powered by&nbsp;
                      <img src="https://www.algolia.com/assets/algolia128x40.png" alt="Algolia" style={{ maxHeight: '12px' }} />
                    </div>
                  </div>
                  <ul style={{ paddingLeft: 0 }}>
                    <li>
                      {
                        (
                          this.props.searchResults &&
                          this.props.searchResults.hits &&
                          this.props.searchResults.hits.length &&
                          this.state.searchValue !== ''
                        ) ? (
                          this.props.searchResults.hits.map((res, i) =>
                            <div className={styles.searchResultsBlock} key={i}>
                              <div dangerouslySetInnerHTML={{ __html: res._highlightResult.content.value }} />
                              <div className="searchResultChannelWrapper">
                                {
                                  res.node.channel ? (
                                    <div style={{ fontSize: '10px' }}>
                                      <em>Jump to channel: </em>
                                      <Link to={`/channels/${res.node.channel.id}`} style={{ color: '#1DAAA0' }}>
                                        {res.node.channel.name}
                                      </Link>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '10px' }}><em>In a private channel</em></div>
                                  )
                                }
                              </div>
                            </div>
                          )
                        ) : (
                          <div className={styles.searchResultsBlock}><em>No results...</em></div>
                        )
                      }
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.messageInputWrapper}>
            <form onSubmit={this.submitMessage}>
              <div className="input-group">
                <input value={this.state.newMessage} onChange={this.onNewMessageChange} type='textarea' placeholder={`Message ${this.props.data.getChannel.name}`} className="form-control" />
                <span className="input-group-btn">
                  <button className="btn btn-info" type="submit" onClick={this.submitMessage}>Send!</button>
                </span>
              </div>
            </form>
          </div>
        </div>
      ) : <h5>Loading...</h5>;
  }
}

const MessagesWithData = compose(
  graphql(ChannelMessagesQuery, {
    options: (props) => {
      const channelId = props.params ? props.params.channelId : null;
      return {
        returnPartialData: true,
        variables: {
          channelId,
          messageOrder: [
            {
              field: 'createdAt',
              direction: 'ASC'
            }
          ],
        },
      };
    },
  }),
  graphql(LoggedInUserQuery, {
    props: ({ data }) => ({
      loggedInUser: data.viewer ? data.viewer.user : null
    })
  }),
  graphql(CreateMessageQuery, {
    props: ({ mutate }) => ({
      createMessage: (message) => mutate({ variables: { message: message } }),
    }),
  }),
  graphql(SearchMessagesQuery, {
    options({ searchTerm }) {
      return {
        variables: { searchTerm: searchTerm || '' }
      };
    },
    props: ({ data }) => {
      return {
        refetchSearchResults: data.refetch ? data.refetch : null,
        searchResults: data.viewer ? data.viewer.searchAlgoliaMessages : null
      }
    }
  }),
)(Messages);
export default MessagesWithData;